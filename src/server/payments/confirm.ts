import "server-only";
import type { PaymentStatus } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/currency";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { templates } from "@/server/email/templates";
import { kickJobs } from "@/server/jobs/kick";
import { enqueue } from "@/server/jobs/queue";
import { postJournal } from "@/server/ledger";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { transitionOrder } from "@/server/orders/service";
import { fromMinorUnits } from "@/server/pricing/money";
import { getPaymentGateway } from "@/server/providers/payment";
import { requestRefund } from "@/server/refunds/service";

/**
 * Payment confirmation. The ONLY path that marks an order PAID.
 * 1. Verify the charge with the gateway server-side (never trust redirects or webhook bodies).
 * 2. Require exact amount (minor units) and currency match.
 * 3. In one transaction: conditional SUCCEEDED update (idempotent), order → PAID, ledger
 *    journal, Fulfilment rows and deduplicated fulfilment jobs.
 * Safe to call any number of times, from webhooks, the return page or reconciliation.
 */

const log = logger.child({ component: "payment-confirm" });

export type ConfirmSource = "webhook" | "return" | "reconcile";

export interface ConfirmResult {
  orderId: string;
  paymentStatus: PaymentStatus;
  outcome: "paid" | "already_paid" | "failed" | "pending" | "abandoned" | "mismatch" | "late_payment_refunded";
}

export async function confirmPayment(reference: string, source: ConfirmSource): Promise<ConfirmResult> {
  const payment = await db.payment.findUnique({ where: { reference }, include: { order: { include: { user: true, items: { include: { product: { select: { supplierId: true } } } } } } } });
  if (!payment) throw new Error("Unknown payment reference");
  if (payment.status === "SUCCEEDED") return { orderId: payment.orderId, paymentStatus: "SUCCEEDED", outcome: "already_paid" };

  const gateway = getPaymentGateway();
  if (gateway.code !== payment.provider) throw new Error(`Payment ${reference} belongs to ${payment.provider}, active gateway is ${gateway.code}`);
  const charge = await gateway.verify(reference);

  if (charge.status === "PENDING") return { orderId: payment.orderId, paymentStatus: payment.status, outcome: "pending" };

  if (charge.status === "FAILED" || charge.status === "REVERSED") {
    await db.$transaction(async (tx) => {
      const upd = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIALIZED", "PENDING"] } }, data: { status: "FAILED", failureReason: charge.gatewayMessage ?? "Payment was declined" } });
      if (upd.count > 0) {
        await transitionOrder(tx, { orderId: payment.orderId, from: "AWAITING_PAYMENT", to: "CANCELLED", reason: "Payment failed", actorType: "WEBHOOK", extra: { cancelledAt: new Date() } });
      }
    });
    return { orderId: payment.orderId, paymentStatus: "FAILED", outcome: "failed" };
  }

  if (charge.status === "ABANDONED") {
    if (source === "reconcile") {
      await db.$transaction(async (tx) => {
        const upd = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIALIZED", "PENDING"] } }, data: { status: "ABANDONED" } });
        if (upd.count > 0) {
          await transitionOrder(tx, { orderId: payment.orderId, from: "AWAITING_PAYMENT", to: "CANCELLED", reason: "Payment not completed in time", actorType: "SYSTEM", extra: { cancelledAt: new Date() } });
        }
      });
      return { orderId: payment.orderId, paymentStatus: "ABANDONED", outcome: "abandoned" };
    }
    return { orderId: payment.orderId, paymentStatus: payment.status, outcome: "pending" };
  }

  // SUCCESS
  const amountMatches = charge.amountMinor === payment.amountMinor && charge.currency.toUpperCase() === payment.currency.toUpperCase();
  const order = payment.order;
  const fee = charge.feeMinor !== null ? fromMinorUnits(charge.feeMinor, payment.currency) : null;

  const result = await db.$transaction(async (tx) => {
    const upd = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "SUCCEEDED" } },
      data: {
        status: "SUCCEEDED",
        gatewayTransactionId: charge.gatewayTransactionId,
        channel: charge.channel,
        gatewayFee: fee ? fee.toFixed(4) : null,
        paidAt: charge.paidAt ?? new Date(),
        verifiedAt: new Date(),
        failureReason: null,
      },
    });
    if (upd.count === 0) return "already_paid" as const;

    // Money is captured: record it in the ledger regardless of what happens next.
    await postJournal(tx, {
      journalRef: `payment:${payment.id}`,
      description: `Payment for order ${order.number}`,
      orderId: order.id,
      paymentId: payment.id,
      lines: [
        { account: "GATEWAY_CLEARING", direction: "DEBIT", amount: fromMinorUnits(charge.amountMinor, payment.currency), currency: payment.currency },
        { account: "SALES_REVENUE", direction: "CREDIT", amount: fromMinorUnits(charge.amountMinor, payment.currency), currency: payment.currency },
      ],
    });
    if (fee && fee.gt(0)) {
      await postJournal(tx, {
        journalRef: `fee:${payment.id}`,
        description: `Gateway fee for order ${order.number}`,
        orderId: order.id,
        paymentId: payment.id,
        lines: [
          { account: "GATEWAY_FEES", direction: "DEBIT", amount: fee, currency: payment.currency },
          { account: "GATEWAY_CLEARING", direction: "CREDIT", amount: fee, currency: payment.currency },
        ],
      });
    }

    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    if (!amountMatches) {
      await transitionOrder(tx, { orderId: order.id, from: "AWAITING_PAYMENT", to: "NEEDS_REVIEW", reason: "Captured amount or currency does not match the order", actorType: "WEBHOOK" });
      await writeAudit({ actorId: null, action: "payment.amount_mismatch", entityType: "order", entityId: order.id, metadata: { expectedMinor: payment.amountMinor.toString(), capturedMinor: charge.amountMinor.toString(), currency: charge.currency } }, tx);
      return "mismatch" as const;
    }
    if (current.status !== "AWAITING_PAYMENT") {
      // e.g. the order expired and was cancelled before the payment arrived.
      return "late" as const;
    }

    await transitionOrder(tx, { orderId: order.id, from: "AWAITING_PAYMENT", to: "PAID", reason: `Payment verified (${source})`, actorType: source === "webhook" ? "WEBHOOK" : "SYSTEM", extra: { paidAt: new Date() } });
    if (order.promotionId) await tx.promotion.update({ where: { id: order.promotionId }, data: { redemptionCount: { increment: 1 } } });

    for (const item of order.items) {
      await tx.fulfilment.upsert({
        where: { orderItemId: item.id },
        update: {},
        create: { orderItemId: item.id, supplierId: item.product.supplierId },
      });
    }
    await enqueue(tx, order.items.map((item) => ({ type: "fulfil-order-item" as const, payload: { orderItemId: item.id }, dedupeKey: `fulfil:${item.id}` })));
    await notify(tx, {
      userId: order.userId,
      type: "order.paid",
      title: "Payment confirmed",
      body: `Order ${order.number} is being prepared.`,
      link: `/dashboard/orders/${order.id}`,
      dedupeKey: `order:${order.id}:paid`,
    });
    return "paid" as const;
  });

  if (result === "paid") {
    log.info("payment confirmed", { orderId: order.id, source });
    await sendEmail({
      to: order.user.email,
      userId: order.userId,
      email: templates.orderPaid({ name: order.user.name, orderNumber: order.number, orderId: order.id, total: formatMoney(order.total.toString(), order.currency) }),
      dedupeKey: `email:order:${order.id}:paid`,
    });
    kickJobs();
    return { orderId: order.id, paymentStatus: "SUCCEEDED", outcome: "paid" };
  }
  if (result === "late") {
    log.warn("payment captured for an order that is no longer awaiting payment; refunding", { orderId: order.id });
    await requestRefund({ orderId: order.id, reason: "Payment received after the order expired", initiatedByType: "SYSTEM", idempotencyKey: `late-payment:${payment.id}` });
    kickJobs();
    return { orderId: order.id, paymentStatus: "SUCCEEDED", outcome: "late_payment_refunded" };
  }
  if (result === "mismatch") return { orderId: order.id, paymentStatus: "SUCCEEDED", outcome: "mismatch" };
  return { orderId: order.id, paymentStatus: "SUCCEEDED", outcome: "already_paid" };
}

/** Job: expire unpaid orders after the payment window, verifying with the gateway first. */
export async function expireUnpaidOrders(windowMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const stale = await db.order.findMany({
    where: { status: "AWAITING_PAYMENT", createdAt: { lt: cutoff } },
    include: { payments: { where: { status: { in: ["INITIALIZED", "PENDING"] } }, select: { reference: true } } },
    take: 50,
  });
  let expired = 0;
  for (const order of stale) {
    const payment = order.payments[0];
    if (payment) {
      try {
        const r = await confirmPayment(payment.reference, "reconcile");
        if (r.outcome === "paid" || r.outcome === "already_paid") continue;
        if (r.outcome === "pending") {
          // Gateway still pending well past the window: cancel the order; a later success refunds automatically.
          await db.payment.updateMany({ where: { reference: payment.reference, status: { in: ["INITIALIZED", "PENDING"] } }, data: { status: "ABANDONED" } });
        }
      } catch (err) {
        log.warn("could not verify stale payment", { orderId: order.id, err });
        continue;
      }
    }
    const ok = await db.$transaction((tx) =>
      transitionOrder(tx, { orderId: order.id, from: "AWAITING_PAYMENT", to: "CANCELLED", reason: "Payment window expired", actorType: "SYSTEM", extra: { cancelledAt: new Date() } }),
    );
    if (ok) expired++;
  }
  return expired;
}
