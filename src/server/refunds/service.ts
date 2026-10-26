import "server-only";
import type { ActorType, OrderStatus } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/currency";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { enqueue, PermanentJobError } from "@/server/jobs/queue";
import { postJournal } from "@/server/ledger";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { transitionOrder } from "@/server/orders/service";
import { dec, sum, toDbAmount, toMinorUnits } from "@/server/pricing/money";
import { getPaymentGateway, PaymentGatewayError } from "@/server/providers/payment";

/**
 * Customer refunds through the payment gateway.
 * REQUESTED → (submit) → PENDING → (gateway confirms) → COMPLETED | FAILED
 * - A refund is COMPLETED only when the gateway confirms it (webhook or status query).
 * - Total refunds can never exceed the captured payment.
 * - An uncertain submission (timeout) is reconciled by listing the gateway's refunds for
 *   the charge before any resubmission.
 */

const log = logger.child({ component: "refunds" });
const REFUNDABLE_FROM: OrderStatus[] = ["PAID", "FULFILLING", "FULFILLED", "NEEDS_REVIEW", "FAILED", "PARTIALLY_REFUNDED"];

export class RefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundError";
  }
}

export async function requestRefund(input: {
  orderId: string;
  amount?: string; // defaults to the full remaining refundable amount
  reason: string;
  initiatedByType: ActorType;
  initiatedById?: string | null;
  idempotencyKey: string;
}): Promise<{ refundId: string; created: boolean }> {
  const existing = await db.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { refundId: existing.id, created: false };

  const refund = await db.$transaction(async (tx) => {
    // Lock the order row so concurrent refund requests cannot over-refund.
    await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${input.orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      include: { payments: { where: { status: "SUCCEEDED" } }, refunds: { where: { status: { in: ["REQUESTED", "PENDING", "COMPLETED"] } } } },
    });
    const payment = order.payments[0];
    if (!payment) throw new RefundError("This order has no captured payment to refund.");
    const alreadyRefunded = sum(order.refunds.map((r) => r.amount));
    const remaining = dec(payment.amount).minus(alreadyRefunded);
    const amount = input.amount ? dec(input.amount) : remaining;
    if (amount.lte(0)) throw new RefundError("Nothing left to refund on this order.");
    if (amount.gt(remaining)) throw new RefundError("Refund exceeds the remaining refundable amount.");
    toMinorUnits(amount, payment.currency); // validates precision for the currency

    const created = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        amount: toDbAmount(amount),
        currency: payment.currency,
        reason: input.reason.slice(0, 300),
        initiatedByType: input.initiatedByType,
        initiatedById: input.initiatedById ?? null,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (REFUNDABLE_FROM.includes(order.status)) {
      await transitionOrder(tx, { orderId: order.id, to: "REFUND_PENDING", reason: input.reason, actorType: input.initiatedByType, actorId: input.initiatedById });
    }
    await writeAudit(
      {
        actorId: input.initiatedById ?? null,
        action: "refund.requested",
        entityType: "order",
        entityId: order.id,
        reason: input.reason,
        metadata: { refundId: created.id, amount: amount.toString(), currency: payment.currency, initiatedBy: input.initiatedByType },
      },
      tx,
    );
    await enqueue(tx, { type: "refund.submit", payload: { refundId: created.id }, dedupeKey: `refund-submit:${created.id}` });
    return created;
  });
  return { refundId: refund.id, created: true };
}

/** Job: submit a REQUESTED refund to the gateway. */
export async function submitRefund(refundId: string): Promise<void> {
  const claimed = await db.refund.updateMany({ where: { id: refundId, status: "REQUESTED", submittedAt: null }, data: { submittedAt: new Date() } });
  if (claimed.count === 0) return;
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  const gateway = getPaymentGateway();
  try {
    const result = await gateway.refund({
      reference: refund.payment.reference,
      gatewayTransactionId: refund.payment.gatewayTransactionId,
      amountMinor: toMinorUnits(refund.amount, refund.currency),
      currency: refund.currency,
      reason: refund.reason,
    });
    await db.refund.update({ where: { id: refundId }, data: { status: "PENDING", gatewayRefundId: result.gatewayRefundId, failureReason: null } });
    await enqueue(db, { type: "refund.reconcile", payload: { refundId }, runAt: new Date(Date.now() + 10 * 60 * 1000), dedupeKey: `refund-reconcile:${refundId}:1` });
    if (gateway.isSandbox) {
      await enqueue(db, { type: "sandbox.refund.process", payload: { gatewayRefundId: result.gatewayRefundId }, runAt: new Date(Date.now() + 2000), dedupeKey: `sbx-refund:${result.gatewayRefundId}` });
    }
    await notifyRefund(refundId, "PENDING");
    if (result.status !== "PENDING") await applyGatewayRefundStatus(refundId, result.status, "submit");
  } catch (err) {
    if (err instanceof PaymentGatewayError && err.opts.uncertain) {
      // The gateway may have created the refund. Never resubmit blindly, reconcile first.
      await db.refund.update({ where: { id: refundId }, data: { failureReason: "Submission outcome uncertain; reconciling with gateway" } });
      await enqueue(db, { type: "refund.reconcile", payload: { refundId }, runAt: new Date(Date.now() + 60 * 1000), dedupeKey: `refund-reconcile:${refundId}:uncertain` });
      return;
    }
    if (err instanceof PaymentGatewayError && err.opts.retryable) {
      await db.refund.update({ where: { id: refundId }, data: { submittedAt: null } });
      throw err; // job backoff retries the submission
    }
    const message = err instanceof Error ? err.message : "Refund rejected by gateway";
    await markRefundFailed(refundId, message);
    throw new PermanentJobError(message);
  }
}

/** Job: confirm a refund's status with the gateway (fallback when no webhook arrives). */
export async function reconcileRefund(refundId: string, attempt = 1): Promise<void> {
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  if (refund.status === "COMPLETED" || refund.status === "FAILED" || refund.status === "REJECTED") return;
  const gateway = getPaymentGateway();

  if (!refund.gatewayRefundId) {
    // Uncertain submission: look for a matching refund on the gateway before deciding.
    const found = (await gateway.listRefunds(refund.payment.reference)).filter(
      (r) => r.amountMinor === null || r.amountMinor === toMinorUnits(refund.amount, refund.currency),
    );
    const linked = await db.refund.findMany({ where: { gatewayRefundId: { in: found.map((f) => f.gatewayRefundId) } }, select: { gatewayRefundId: true } });
    const unlinked = found.filter((f) => !linked.some((l) => l.gatewayRefundId === f.gatewayRefundId));
    if (unlinked.length === 1) {
      await db.refund.update({ where: { id: refundId }, data: { status: "PENDING", gatewayRefundId: unlinked[0]!.gatewayRefundId, failureReason: null } });
      if (unlinked[0]!.status !== "PENDING") await applyGatewayRefundStatus(refundId, unlinked[0]!.status, "reconcile");
      return;
    }
    if (unlinked.length === 0 && attempt >= 3) {
      // The gateway has no record after several checks: safe to resubmit.
      await db.refund.update({ where: { id: refundId }, data: { submittedAt: null, failureReason: null } });
      await enqueue(db, { type: "refund.submit", payload: { refundId }, dedupeKey: `refund-submit:${refundId}:retry:${Date.now()}` });
      return;
    }
    if (unlinked.length > 1) {
      await markRefundFailed(refundId, "Multiple matching gateway refunds found; manual review required");
      return;
    }
  } else {
    const status = (await gateway.getRefund(refund.gatewayRefundId)).status;
    if (status !== "PENDING") {
      await applyGatewayRefundStatus(refundId, status, "reconcile");
      return;
    }
  }
  if (attempt < 12) {
    await enqueue(db, { type: "refund.reconcile", payload: { refundId, attempt: attempt + 1 }, runAt: new Date(Date.now() + Math.min(6 * 3600, 600 * attempt) * 1000), dedupeKey: `refund-reconcile:${refundId}:${attempt + 1}` });
  }
}

/** Apply a gateway-confirmed refund status (from a verified webhook or status query). */
export async function applyGatewayRefundStatus(refundId: string, status: "PENDING" | "PROCESSED" | "FAILED", source: string): Promise<void> {
  if (status === "PENDING") return;
  if (status === "FAILED") return markRefundFailed(refundId, `Gateway reported refund failure (${source})`);

  const completed = await db.$transaction(async (tx) => {
    const upd = await tx.refund.updateMany({ where: { id: refundId, status: { in: ["REQUESTED", "PENDING"] } }, data: { status: "COMPLETED", completedAt: new Date(), failureReason: null } });
    if (upd.count === 0) return false;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true, order: { include: { refunds: { where: { status: "COMPLETED" } } } } } });
    await postJournal(tx, {
      journalRef: `refund:${refund.id}`,
      description: `Refund for order ${refund.order.number}`,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      refundId: refund.id,
      lines: [
        { account: "CUSTOMER_REFUNDS", direction: "DEBIT", amount: refund.amount, currency: refund.currency },
        { account: "GATEWAY_CLEARING", direction: "CREDIT", amount: refund.amount, currency: refund.currency },
      ],
    });
    const totalRefunded = sum(refund.order.refunds.map((r) => r.amount));
    const fully = totalRefunded.gte(dec(refund.payment.amount));
    if (refund.order.status === "REFUND_PENDING") {
      await transitionOrder(tx, { orderId: refund.orderId, to: fully ? "REFUNDED" : "PARTIALLY_REFUNDED", reason: `Refund confirmed by gateway (${source})`, actorType: "SYSTEM" });
    }
    return true;
  });
  if (completed) await notifyRefund(refundId, "COMPLETED");
}

async function markRefundFailed(refundId: string, reason: string): Promise<void> {
  const changed = await db.$transaction(async (tx) => {
    const upd = await tx.refund.updateMany({ where: { id: refundId, status: { in: ["REQUESTED", "PENDING"] } }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } });
    if (upd.count === 0) return false;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, select: { orderId: true } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId }, select: { status: true } });
    if (order.status === "REFUND_PENDING") {
      await transitionOrder(tx, { orderId: refund.orderId, to: "NEEDS_REVIEW", reason: `Refund failed: ${reason}`, actorType: "SYSTEM" });
    }
    return true;
  });
  if (changed) {
    log.error("refund failed", { refundId, reason });
    await notifyRefund(refundId, "FAILED");
  }
}

async function notifyRefund(refundId: string, status: "PENDING" | "COMPLETED" | "FAILED"): Promise<void> {
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: { include: { user: true } } } });
  const amount = formatMoney(refund.amount.toString(), refund.currency);
  const titles = { PENDING: "Refund started", COMPLETED: "Refund completed", FAILED: "Refund needs attention" };
  await notify(db, {
    userId: refund.order.userId,
    type: `refund.${status.toLowerCase()}`,
    title: titles[status],
    body: `${amount} for order ${refund.order.number}`,
    link: "/dashboard/refunds",
    dedupeKey: `refund:${refundId}:${status}`,
  });
  await sendEmail({
    to: refund.order.user.email,
    userId: refund.order.userId,
    email: templates.refundUpdate({ name: refund.order.user.name, orderNumber: refund.order.number, amount, status }),
    dedupeKey: `email:refund:${refundId}:${status}`,
  });
}
