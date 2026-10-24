import "server-only";
import { encryptField, encryptOptional } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { kickJobs } from "@/server/jobs/kick";
import { postJournal } from "@/server/ledger";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { getSupplierAdapter, isSupplierError } from "@/server/providers/supplier";
import type { SmsMessageInfo } from "@/server/providers/supplier/types";
import { requestRefund } from "@/server/refunds/service";
import { getSetting } from "@/server/settings";

/**
 * Verification sessions and rentals after issue: SMS storage (encrypted, deduplicated),
 * polling fallback, customer cancellation and expiry refunds.
 */

const log = logger.child({ component: "verification" });
/** Supplier auto-refunds expired activations ~10 minutes after expiry (documented). */
const SUPPLIER_EXPIRY_REFUND_DELAY_MS = 11 * 60 * 1000;
const EXPIRY_GIVE_UP_MS = 2 * 60 * 60 * 1000;

export async function storeMessages(
  target: { verificationId?: string; rentalId?: string; userId: string; supplierId: string },
  messages: SmsMessageInfo[],
): Promise<number> {
  if (messages.length === 0) return 0;
  const res = await db.incomingSmsMessage.createMany({
    data: messages.map((m) => ({
      supplierId: target.supplierId,
      supplierMessageId: m.supplierMessageId,
      userId: target.userId,
      verificationId: target.verificationId ?? null,
      rentalId: target.rentalId ?? null,
      sender: m.sender ? m.sender.slice(0, 100) : null,
      bodyEnc: encryptField(m.text.slice(0, 2000)),
      codeEnc: encryptOptional(m.code ? m.code.slice(0, 32) : null),
      receivedAt: m.receivedAt,
    })),
    skipDuplicates: true, // unique (supplierId, supplierMessageId): repeated deliveries are ignored
  });
  return res.count;
}

async function announceSms(userId: string, path: string, dedupeKey: string): Promise<void> {
  await notify(db, { userId, type: "sms.received", title: "New SMS received", body: "Open your dashboard to read it.", link: path, dedupeKey });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
  await sendEmail({ to: user.email, userId, email: templates.smsReceived({ name: user.name, path }), dedupeKey: `email:${dedupeKey}` });
}

/** Handle a verified sms.received supplier webhook. */
export async function applySmsWebhook(supplierId: string, product: "activation" | "rental", supplierRef: string, message: SmsMessageInfo): Promise<boolean> {
  if (product === "activation") {
    const v = await db.verificationActivation.findUnique({ where: { supplierId_supplierOrderRef: { supplierId, supplierOrderRef: supplierRef } } });
    if (!v) return false;
    const added = await storeMessages({ verificationId: v.id, userId: v.userId, supplierId }, [message]);
    if (added > 0) {
      await db.verificationActivation.updateMany({ where: { id: v.id, status: "WAITING" }, data: { status: "RECEIVED" } });
      await announceSms(v.userId, `/dashboard/verification/${v.id}`, `sms:verification:${v.id}:first`);
    }
    return true;
  }
  const r = await db.phoneNumberRental.findUnique({ where: { supplierId_supplierNumberId: { supplierId, supplierNumberId: supplierRef } } });
  if (!r) return false;
  const added = await storeMessages({ rentalId: r.id, userId: r.userId, supplierId }, [message]);
  if (added > 0) await announceSms(r.userId, "/dashboard/rentals", `sms:rental:${r.id}:${message.supplierMessageId}`);
  return true;
}

/** Pull the latest state and messages from the supplier for one session. */
export async function refreshVerification(verificationId: string): Promise<void> {
  const v = await db.verificationActivation.findUniqueOrThrow({ where: { id: verificationId } });
  const adapter = getSupplierAdapter();
  const info = await adapter.verification.getActivation(v.supplierOrderRef);
  const added = await storeMessages({ verificationId: v.id, userId: v.userId, supplierId: v.supplierId }, info.messages);
  const hasMessages = added > 0 || (await db.incomingSmsMessage.count({ where: { verificationId: v.id } })) > 0;
  const status =
    info.state === "REFUNDED" ? (hasMessages ? "COMPLETED" : "REFUNDED")
    : info.state === "EXPIRED" ? (hasMessages ? "COMPLETED" : "EXPIRED")
    : info.state === "COMPLETED" ? "COMPLETED"
    : info.state === "CANCELLED" ? "CANCELLED"
    : hasMessages ? "RECEIVED"
    : "WAITING";
  await db.verificationActivation.update({
    where: { id: v.id },
    data: { status, supplierStatus: info.supplierStatus, lastCheckedAt: new Date(), expiresAt: info.expiresAt, ...(status === "COMPLETED" && !v.completedAt ? { completedAt: new Date() } : {}) },
  });
  if (added > 0 && v.status === "WAITING") await announceSms(v.userId, `/dashboard/verification/${v.id}`, `sms:verification:${v.id}:first`);
}

/** The supplier refunded us for an activation: reverse its recorded cost in the ledger. */
async function reverseSupplierCost(verificationId: string, amount: string | null): Promise<void> {
  const v = await db.verificationActivation.findUniqueOrThrow({
    where: { id: verificationId },
    include: { orderItem: { include: { fulfilment: true, order: { select: { number: true } } } } },
  });
  const cost = amount && Number(amount) > 0 ? amount : v.orderItem.fulfilment?.supplierCost?.toString();
  if (!cost || Number(cost) <= 0) return;
  const currency = getSupplierAdapter().priceCurrency;
  await db.$transaction((tx) =>
    postJournal(tx, {
      journalRef: `supplier-refund:${v.id}`,
      description: `Supplier refund for order ${v.orderItem.order.number}`,
      orderId: v.orderItem.orderId,
      lines: [
        { account: "SUPPLIER_PREPAID", direction: "DEBIT", amount: cost, currency },
        { account: "SUPPLIER_COST", direction: "CREDIT", amount: cost, currency },
      ],
    }),
  );
}

export type CancelOutcome = { ok: true; refunded: boolean } | { ok: false; error: string };

/** Customer cancellation: only before any SMS arrives and before expiry; refund follows the supplier. */
export async function cancelVerification(userId: string, verificationId: string): Promise<CancelOutcome> {
  const v = await db.verificationActivation.findFirst({ where: { id: verificationId, userId }, include: { orderItem: { select: { orderId: true } } } });
  if (!v) return { ok: false, error: "Session not found." };
  if (v.status !== "WAITING") return { ok: false, error: "This session can no longer be cancelled." };
  if (v.expiresAt <= new Date()) return { ok: false, error: "This number has already expired." };
  if ((await db.incomingSmsMessage.count({ where: { verificationId: v.id } })) > 0) return { ok: false, error: "A message was already received, so it cannot be cancelled." };

  const claimed = await db.verificationActivation.updateMany({ where: { id: v.id, status: "WAITING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (claimed.count === 0) return { ok: false, error: "This session was updated. Please refresh." };

  try {
    const result = await getSupplierAdapter().verification.cancelActivation(v.supplierOrderRef);
    const refunded = Number(result.refundAmount) > 0 || result.state === "REFUNDED";
    await db.verificationActivation.update({
      where: { id: v.id },
      data: { status: refunded ? "REFUNDED" : "CANCELLED", supplierStatus: result.supplierStatus, supplierRefundAmount: result.refundAmount },
    });
    if (refunded) {
      await reverseSupplierCost(v.id, result.refundAmount);
      await requestRefund({
        orderId: v.orderItem.orderId,
        reason: "Verification cancelled before any SMS was received",
        initiatedByType: "CUSTOMER",
        initiatedById: userId,
        idempotencyKey: `verification-refund:${v.id}`,
      });
      kickJobs();
    }
    return { ok: true, refunded };
  } catch (err) {
    // Roll back our local cancellation; the supplier did not confirm it.
    await db.verificationActivation.update({ where: { id: v.id }, data: { status: "WAITING", cancelledAt: null } });
    log.warn("supplier rejected cancellation", { verificationId: v.id, err });
    const msg = isSupplierError(err) && err.kind === "INVALID_REQUEST" ? "The supplier did not allow this cancellation." : "We could not cancel right now. Please try again.";
    return { ok: false, error: msg };
  }
}

/**
 * Sweep: poll active sessions that have not been checked recently (webhooks are primary),
 * and settle expired sessions — refunding the customer when the supplier refunded us.
 */
export async function sweepVerifications(limit = 20): Promise<{ polled: number; settled: number }> {
  const now = Date.now();
  const active = await db.verificationActivation.findMany({
    where: {
      status: { in: ["WAITING", "RECEIVED"] },
      expiresAt: { gt: new Date(now) },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now - 45 * 1000) } }],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: limit,
    select: { id: true },
  });
  let polled = 0;
  for (const v of active) {
    try {
      await refreshVerification(v.id);
      polled++;
    } catch (err) {
      log.warn("verification poll failed", { verificationId: v.id, err });
    }
  }

  const expired = await db.verificationActivation.findMany({
    where: { status: { in: ["WAITING", "EXPIRED"] }, completedAt: null, expiresAt: { lt: new Date(now - SUPPLIER_EXPIRY_REFUND_DELAY_MS) } },
    take: limit,
    include: { orderItem: { select: { orderId: true } }, _count: { select: { messages: true } } },
  });
  const autoRefund = await getSetting("verification.autoRefundOnExpiry");
  let settled = 0;
  for (const v of expired) {
    try {
      const info = await getSupplierAdapter().verification.getActivation(v.supplierOrderRef);
      const noSms = v._count.messages === 0 && info.messages.length === 0;
      if (info.state === "REFUNDED" && noSms) {
        await db.verificationActivation.update({ where: { id: v.id }, data: { status: "REFUNDED", supplierStatus: info.supplierStatus, completedAt: new Date() } });
        await reverseSupplierCost(v.id, null);
        if (autoRefund) {
          await requestRefund({
            orderId: v.orderItem.orderId,
            reason: "No SMS received before the number expired",
            initiatedByType: "SYSTEM",
            idempotencyKey: `verification-refund:${v.id}`,
          });
        }
        settled++;
      } else if (Date.now() - v.expiresAt.getTime() > EXPIRY_GIVE_UP_MS || !noSms) {
        // Supplier did not refund (or an SMS arrived): close the session without a refund.
        await db.verificationActivation.update({ where: { id: v.id }, data: { status: noSms ? "EXPIRED" : "COMPLETED", supplierStatus: info.supplierStatus, completedAt: new Date() } });
        settled++;
      } else if (v.status !== "EXPIRED") {
        await db.verificationActivation.update({ where: { id: v.id }, data: { status: "EXPIRED", supplierStatus: info.supplierStatus } });
      }
    } catch (err) {
      log.warn("verification expiry check failed", { verificationId: v.id, err });
    }
  }
  if (settled > 0) kickJobs();
  return { polled, settled };
}

/** Sweep: rental expiry reminders, message polling fallback and expiry. */
export async function sweepRentals(limit = 50): Promise<{ reminded: number; expired: number; polled: number }> {
  const hours = await getSetting("rentals.reminderHoursBefore");
  const now = new Date();
  const soon = new Date(now.getTime() + hours * 3600 * 1000);
  const reminders = await db.phoneNumberRental.findMany({
    where: { status: "ACTIVE", reminderSentAt: null, expiresAt: { gt: now, lte: soon } },
    include: { user: { select: { email: true, name: true } } },
    take: limit,
  });
  for (const r of reminders) {
    await notify(db, { userId: r.userId, type: "rental.expiring", title: "Rental expiring soon", body: `Your number ending ${r.phoneNumber.slice(-4)} expires ${r.expiresAt.toUTCString()}.`, link: "/dashboard/rentals", dedupeKey: `rental-expiring:${r.id}` });
    await sendEmail({
      to: r.user.email,
      userId: r.userId,
      email: templates.rentalExpiring({ name: r.user.name, phoneLast4: r.phoneNumber.slice(-4), expiresAt: r.expiresAt.toUTCString(), rentalId: r.id }),
      dedupeKey: `email:rental-expiring:${r.id}`,
    });
    await db.phoneNumberRental.update({ where: { id: r.id }, data: { reminderSentAt: new Date() } });
  }

  const expired = await db.phoneNumberRental.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });

  const toPoll = await db.phoneNumberRental.findMany({
    where: { status: "ACTIVE", OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) } }] },
    take: 10,
  });
  let polled = 0;
  for (const r of toPoll) {
    try {
      const info = await getSupplierAdapter().rentals.getRental(r.supplierNumberId);
      const added = await storeMessages({ rentalId: r.id, userId: r.userId, supplierId: r.supplierId }, info.messages);
      if (added > 0) await announceSms(r.userId, "/dashboard/rentals", `sms:rental:${r.id}:poll:${Date.now()}`);
      await db.phoneNumberRental.update({ where: { id: r.id }, data: { lastCheckedAt: new Date(), status: info.state === "ACTIVE" ? "ACTIVE" : info.state, expiresAt: info.expiresAt } });
      polled++;
    } catch (err) {
      log.warn("rental poll failed", { rentalId: r.id, err });
    }
  }
  return { reminded: reminders.length, expired: expired.count, polled };
}
