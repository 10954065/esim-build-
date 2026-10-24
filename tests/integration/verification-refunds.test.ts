import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { __resetPaymentGatewayForTests, getPaymentGateway, PaymentGatewayError, type PaymentGateway } from "@/server/providers/payment";
import { __resetSupplierAdapterForTests, type SupplierAdapter } from "@/server/providers/supplier";
import { SupplierError } from "@/server/providers/supplier/errors";
import { createSandboxAdapter } from "@/server/providers/supplier/sandbox/adapter";
import type { ActivationInfo } from "@/server/providers/supplier/types";
import { RefundError, requestRefund } from "@/server/refunds/service";
import { processSandboxRefund, simulateSandboxSms } from "@/server/sandbox/ops";
import { applySmsWebhook, cancelVerification, refreshVerification, storeMessages, sweepRentals, sweepVerifications } from "@/server/verification/service";
import { checkoutAndPay, drainJobs, ledgerIsBalanced, resetDatabase, seedPricingAndCatalog } from "./helpers";

const sandbox = createSandboxAdapter({ signingSecret: process.env.SANDBOX_SIGNING_SECRET, priceCurrency: "USD" });

/** Override the supplier's view of one activation; every other reference behaves normally. */
function supplierActivation(ref: string, overrides: { get?: (base: ActivationInfo) => ActivationInfo; cancel?: () => Promise<never> }) {
  const verification: SupplierAdapter["verification"] = {
    ...sandbox.verification,
    async getActivation(id) {
      const base = await sandbox.verification.getActivation(id);
      return id === ref && overrides.get ? overrides.get(base) : base;
    },
    async cancelActivation(id) {
      if (id === ref && overrides.cancel) return overrides.cancel();
      return sandbox.verification.cancelActivation(id);
    },
  };
  __resetSupplierAdapterForTests({ ...sandbox, verification });
}

async function paid(where: Prisma.ProductWhereInput) {
  const o = await checkoutAndPay(where);
  await drainJobs();
  return o;
}

async function issuedVerification() {
  const o = await paid({ type: "VERIFICATION", isActive: true, stockCount: { gt: 0 }, service: { slug: { not: "demo-fail" } } });
  const v = await db.verificationActivation.findFirstOrThrow({ where: { orderItem: { orderId: o.orderId } } });
  return { ...o, v };
}

const sms = (id: string, text: string) => ({ supplierMessageId: id, sender: "Google", text, code: "123456", receivedAt: new Date() });
const refundsOf = (orderId: string) => db.refund.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
const orderStatus = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

describe("verification sessions after issue (real database)", () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedPricingAndCatalog();
  });

  afterEach(() => {
    __resetSupplierAdapterForTests();
    __resetPaymentGatewayForTests();
  });

  it("a cancellation whose response was lost is refunded once the supplier shows the refund", async () => {
    const { orderId, v } = await issuedVerification();
    supplierActivation(v.supplierOrderRef, {
      cancel: () => Promise.reject(new SupplierError("UNCERTAIN", "timeout")),
      get: (base) => ({ ...base, state: "REFUNDED", supplierStatus: "REFUNDED" }),
    });

    const attempt = await cancelVerification(v.userId, v.id);
    expect(attempt).toEqual({ ok: false, error: "We could not cancel right now. Please try again." });
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("WAITING");

    await refreshVerification(v.id);
    await refreshVerification(v.id); // a second poll must not refund twice
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("REFUNDED");
    await drainJobs(10);
    expect((await refundsOf(orderId)).map((r) => r.status)).toEqual(["COMPLETED"]);
    expect(await orderStatus(orderId)).toBe("REFUNDED");
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("a cancellation the supplier refuses leaves the session open and refunds nothing", async () => {
    const { orderId, v } = await issuedVerification();
    supplierActivation(v.supplierOrderRef, { cancel: () => Promise.reject(new SupplierError("INVALID_REQUEST", "Cannot cancel", { httpStatus: 400 })) });
    expect(await cancelVerification(v.userId, v.id)).toEqual({ ok: false, error: "The supplier did not allow this cancellation." });
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("WAITING");
    expect(await refundsOf(orderId)).toHaveLength(0);
  });

  it("cannot cancel after an SMS arrived, after expiry, or a session that is not the customer's", async () => {
    const { v } = await issuedVerification();
    expect(await cancelVerification("someone-else", v.id)).toEqual({ ok: false, error: "Session not found." });

    await simulateSandboxSms({ kind: "activation", supplierRef: v.supplierOrderRef }, "Your code is 111222", "111222");
    expect(await cancelVerification(v.userId, v.id)).toEqual({ ok: false, error: "This session can no longer be cancelled." });

    const other = await issuedVerification();
    await db.verificationActivation.update({ where: { id: other.v.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await cancelVerification(other.v.userId, other.v.id)).toEqual({ ok: false, error: "This number has already expired." });
  });

  it("polling stores new SMS once, even when the supplier repeats them", async () => {
    const { v } = await issuedVerification();
    const message = sms(`m-${v.id}`, "G-123456 is your Google code");
    supplierActivation(v.supplierOrderRef, { get: (base) => ({ ...base, state: "RECEIVED", messages: [message] }) });
    await refreshVerification(v.id);
    await refreshVerification(v.id);
    const rows = await db.incomingSmsMessage.findMany({ where: { verificationId: v.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.bodyEnc).not.toContain("123456");
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RECEIVED");
  });

  it("expiry sweep: refunds when the supplier refunded and no SMS arrived", async () => {
    const { orderId, v } = await issuedVerification();
    await db.verificationActivation.update({ where: { id: v.id }, data: { expiresAt: new Date(Date.now() - 12 * 60 * 1000) } });
    supplierActivation(v.supplierOrderRef, { get: (base) => ({ ...base, state: "REFUNDED", supplierStatus: "REFUNDED" }) });

    const r = await sweepVerifications();
    expect(r.settled).toBeGreaterThanOrEqual(1);
    await drainJobs(10);
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("REFUNDED");
    expect((await refundsOf(orderId)).map((x) => x.status)).toEqual(["COMPLETED"]);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("expiry sweep: closes without a refund when an SMS was delivered", async () => {
    const { orderId, v } = await issuedVerification();
    await storeMessages({ verificationId: v.id, userId: v.userId, supplierId: v.supplierId }, [sms(`d-${v.id}`, "code 999000")]);
    await db.verificationActivation.update({ where: { id: v.id }, data: { expiresAt: new Date(Date.now() - 12 * 60 * 1000) } });
    supplierActivation(v.supplierOrderRef, { get: (base) => ({ ...base, state: "EXPIRED", supplierStatus: "EXPIRED" }) });

    await sweepVerifications();
    const after = await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.completedAt).not.toBeNull();
    expect(await refundsOf(orderId)).toHaveLength(0);
  });

  it("expiry sweep: gives up without a refund when the supplier never refunds", async () => {
    const { orderId, v } = await issuedVerification();
    await db.verificationActivation.update({ where: { id: v.id }, data: { expiresAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
    supplierActivation(v.supplierOrderRef, { get: (base) => ({ ...base, state: "EXPIRED", supplierStatus: "EXPIRED" }) });
    await sweepVerifications();
    expect((await db.verificationActivation.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("EXPIRED");
    expect(await refundsOf(orderId)).toHaveLength(0);
  });

  it("SMS webhooks for unknown numbers are ignored; rental SMS are stored once", async () => {
    const supplier = await db.supplier.findFirstOrThrow({ where: { code: "sandbox" } });
    expect(await applySmsWebhook(supplier.id, "activation", "unknown-ref", sms("x1", "hi"))).toBe(false);
    expect(await applySmsWebhook(supplier.id, "rental", "unknown-ref", sms("x2", "hi"))).toBe(false);

    const { orderId } = await paid({ type: "RENTAL", rentalTerm: "7d", country: { code: "GB" } });
    const rental = await db.phoneNumberRental.findFirstOrThrow({ where: { orderItem: { orderId } } });
    const message = sms(`r-${rental.id}`, "Your WhatsApp code: 482-910");
    expect(await applySmsWebhook(supplier.id, "rental", rental.supplierNumberId, message)).toBe(true);
    expect(await applySmsWebhook(supplier.id, "rental", rental.supplierNumberId, message)).toBe(true);
    expect(await db.incomingSmsMessage.count({ where: { rentalId: rental.id } })).toBe(1);
  });

  it("rental sweep: reminds once before expiry and expires rentals past their end", async () => {
    const soon = await paid({ type: "RENTAL", rentalTerm: "7d", country: { code: "GB" } });
    const ending = await db.phoneNumberRental.findFirstOrThrow({ where: { orderItem: { orderId: soon.orderId } } });
    await db.phoneNumberRental.update({ where: { id: ending.id }, data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });

    const done = await paid({ type: "RENTAL", rentalTerm: "7d", country: { code: "GB" } });
    const over = await db.phoneNumberRental.findFirstOrThrow({ where: { orderItem: { orderId: done.orderId } } });
    await db.phoneNumberRental.update({ where: { id: over.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const first = await sweepRentals();
    expect(first.reminded).toBeGreaterThanOrEqual(1);
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect((await db.phoneNumberRental.findUniqueOrThrow({ where: { id: ending.id } })).reminderSentAt).not.toBeNull();
    expect((await db.phoneNumberRental.findUniqueOrThrow({ where: { id: over.id } })).status).toBe("EXPIRED");

    const second = await sweepRentals();
    expect(second.reminded).toBe(0);
  });
});

describe("refunds (real database)", () => {
  afterEach(() => {
    __resetPaymentGatewayForTests();
  });

  async function fulfilledEsim() {
    return paid({ supplierProductCode: "SBX-ES-1GB-7D" });
  }

  it("partial refunds add up to the captured amount and never exceed it", async () => {
    const { orderId, payment } = await fulfilledEsim();
    const total = Number(payment.amount);

    await requestRefund({ orderId, amount: "1.00", reason: "Goodwill", initiatedByType: "STAFF", idempotencyKey: `p1-${orderId}` });
    await drainJobs(10);
    expect(await orderStatus(orderId)).toBe("PARTIALLY_REFUNDED");

    await expect(requestRefund({ orderId, amount: String(total), reason: "Too much", initiatedByType: "STAFF", idempotencyKey: `p2-${orderId}` })).rejects.toThrow(RefundError);

    const again = await requestRefund({ orderId, amount: "1.00", reason: "Goodwill", initiatedByType: "STAFF", idempotencyKey: `p1-${orderId}` });
    expect(again.created).toBe(false);

    await requestRefund({ orderId, reason: "Rest", initiatedByType: "STAFF", idempotencyKey: `p3-${orderId}` });
    await drainJobs(10);
    expect(await orderStatus(orderId)).toBe("REFUNDED");
    const refunds = await refundsOf(orderId);
    expect(refunds.reduce((s, r) => s + Number(r.amount), 0)).toBeCloseTo(total, 4);

    await expect(requestRefund({ orderId, reason: "More", initiatedByType: "STAFF", idempotencyKey: `p4-${orderId}` })).rejects.toThrow("Nothing left to refund");
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("an uncertain refund submission is matched to the gateway's record instead of being resubmitted", async () => {
    const { orderId } = await fulfilledEsim();
    const real = getPaymentGateway();
    let submissions = 0;
    let createdId = "";
    const gateway: PaymentGateway = {
      ...real,
      async refund(input) {
        submissions++;
        createdId = (await real.refund(input)).gatewayRefundId;
        throw new PaymentGatewayError("Payment gateway unreachable", { retryable: true, uncertain: true });
      },
    };
    __resetPaymentGatewayForTests(gateway);

    const { refundId } = await requestRefund({ orderId, reason: "Customer request", initiatedByType: "STAFF", idempotencyKey: `u-${orderId}` });
    await drainJobs(10);
    const linked = await db.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(submissions).toBe(1);
    expect(linked.gatewayRefundId).toBe(createdId);
    expect(linked.status).toBe("PENDING");

    await processSandboxRefund(createdId);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).status).toBe("COMPLETED");
    expect(await orderStatus(orderId)).toBe("REFUNDED");
  });

  it("an uncertain submission the gateway never received is resubmitted after repeated checks", async () => {
    const { orderId } = await fulfilledEsim();
    const real = getPaymentGateway();
    let submissions = 0;
    __resetPaymentGatewayForTests({
      ...real,
      async refund(input) {
        submissions++;
        if (submissions === 1) throw new PaymentGatewayError("Payment gateway unreachable", { retryable: true, uncertain: true });
        return real.refund(input);
      },
    });
    await requestRefund({ orderId, reason: "Customer request", initiatedByType: "STAFF", idempotencyKey: `n-${orderId}` });
    await drainJobs(12);
    expect(submissions).toBe(2);
    expect(await orderStatus(orderId)).toBe("REFUNDED");
  });

  it("a refund the gateway rejects is marked failed and the order goes to review", async () => {
    const { orderId } = await fulfilledEsim();
    __resetPaymentGatewayForTests({
      ...getPaymentGateway(),
      async refund() {
        throw new PaymentGatewayError("Refund window closed", { retryable: false, uncertain: false, httpStatus: 400 });
      },
    });
    const { refundId } = await requestRefund({ orderId, reason: "Customer request", initiatedByType: "STAFF", idempotencyKey: `f-${orderId}` });
    await drainJobs(6);
    const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(refund.status).toBe("FAILED");
    expect(refund.failureReason).toBe("Refund window closed");
    expect(await orderStatus(orderId)).toBe("NEEDS_REVIEW");
  });
});
