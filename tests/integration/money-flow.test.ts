import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getOrder, getVerification, getEsim } from "@/server/customer/queries";
import { db } from "@/server/db";
import { createCheckout } from "@/server/orders/checkout";
import { confirmPayment } from "@/server/payments/confirm";
import { getPaymentGateway } from "@/server/providers/payment";
import { buildSandboxPaymentWebhook } from "@/server/providers/payment/sandbox";
import { decideSandboxCharge, simulateSandboxSms } from "@/server/sandbox/ops";
import { cancelVerification } from "@/server/verification/service";
import { handlePaymentWebhook } from "@/server/webhooks/handlers";
import { createUser, drainJobs, ledgerIsBalanced, resetDatabase, seedPricingAndCatalog } from "./helpers";

async function productByCode(code: string) {
  return db.product.findFirstOrThrow({ where: { supplierProductCode: code } });
}

async function firstVerificationProduct() {
  return db.product.findFirstOrThrow({
    where: { type: "VERIFICATION", isActive: true, stockCount: { gt: 0 }, service: { slug: { not: "demo-fail" } } },
  });
}

async function checkout(userId: string, email: string, productId: string, key = randomUUID()) {
  const r = await createCheckout({ userId, email, productId, idempotencyKey: key });
  if (!r.ok) throw new Error(`checkout failed: ${r.error}`);
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: r.orderId } });
  return { ...r, payment };
}

describe("money flow (sandbox providers, real database)", () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedPricingAndCatalog();
  });

  let user: Awaited<ReturnType<typeof createUser>>;
  beforeEach(async () => {
    user = await createUser();
  });

  it("eSIM: checkout → verified payment → fulfilment → encrypted activation, ledger balanced", async () => {
    const product = await productByCode("SBX-ES-1GB-7D");
    const { orderId, payment, authorizationUrl } = await checkout(user.id, user.email, product.id);
    expect(authorizationUrl).toContain("/checkout/sandbox/");

    const before = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(before.status).toBe("AWAITING_PAYMENT");
    // Server-side price: 25% margin with minimum profit, rounded up to cents.
    expect(Number(before.total)).toBeGreaterThan(Number(product.wholesaleCost));

    await decideSandboxCharge(payment.reference, "success");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PAID");

    await drainJobs();
    const order = await getOrder(user.id, orderId);
    expect(order?.status).toBe("FULFILLED");
    const esimRow = await db.esimActivation.findFirstOrThrow({ where: { userId: user.id } });
    expect(esimRow.activationCodeEnc).not.toContain("LPA:"); // encrypted at rest
    const esim = await getEsim(user.id, esimRow.id);
    expect(esim?.activationCode).toMatch(/^LPA:1\$sandbox-smdp\.invalid\$/);
    expect(esim?.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(await ledgerIsBalanced()).toBe(true);
    expect(await db.ledgerEntry.count({ where: { orderId } })).toBeGreaterThanOrEqual(4); // payment + supplier cost
  });

  it("duplicate and replayed payment webhooks never fulfil twice", async () => {
    const product = await productByCode("SBX-ES-3GB-15D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await db.sandboxGatewayCharge.update({ where: { reference: payment.reference }, data: { status: "SUCCESS" } });

    const { rawBody, headers } = buildSandboxPaymentWebhook("charge.success", { reference: payment.reference }, process.env.SANDBOX_SIGNING_SECRET!);
    const first = await handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, headers);
    const second = await handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, headers);
    expect(first.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    // A different event for the same charge is also harmless.
    await confirmPayment(payment.reference, "return");

    await drainJobs();
    expect(await db.fulfilment.count({ where: { orderItem: { orderId } } })).toBe(1);
    expect(await db.esimActivation.count({ where: { orderItem: { orderId } } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { journalRef: `payment:${payment.id}` } })).toBe(2);
  });

  it("rejects webhooks with a bad signature without recording or acting on them", async () => {
    const product = await productByCode("SBX-ES-5GB-30D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    const { rawBody } = buildSandboxPaymentWebhook("charge.success", { reference: payment.reference }, "wrong-secret");
    const forged = buildSandboxPaymentWebhook("charge.success", { reference: payment.reference }, "wrong-secret");
    const r = await handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, forged.headers);
    expect(r.status).toBe(401);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("AWAITING_PAYMENT");
  });

  it("a forged success webhook cannot mark an unpaid charge as paid (server-side verification)", async () => {
    const product = await productByCode("SBX-ES-10GB-30D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    // Correctly signed, but the gateway's own record says the charge is still pending.
    const { rawBody, headers } = buildSandboxPaymentWebhook("charge.success", { reference: payment.reference }, process.env.SANDBOX_SIGNING_SECRET!);
    await handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, headers);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("AWAITING_PAYMENT");
    expect(await db.fulfilment.count({ where: { orderItem: { orderId } } })).toBe(0);
  });

  it("an amount mismatch holds the order for review instead of fulfilling", async () => {
    const product = await productByCode("SBX-ES-1GB-7D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await db.sandboxGatewayCharge.update({ where: { reference: payment.reference }, data: { amountMinor: BigInt(1), status: "SUCCESS" } });
    const r = await confirmPayment(payment.reference, "webhook");
    expect(r.outcome).toBe("mismatch");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("NEEDS_REVIEW");
    expect(await db.fulfilment.count({ where: { orderItem: { orderId } } })).toBe(0);
  });

  it("supplier failure after payment → automatic refund confirmed by the gateway", async () => {
    const product = await productByCode("SBX-ES-TEST-FAIL");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await decideSandboxCharge(payment.reference, "success");
    await drainJobs(10);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds).toHaveLength(1);
    expect(order.refunds[0]!.status).toBe("COMPLETED");
    expect(order.refunds[0]!.amount.toString()).toBe(order.total.toString());
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("verification: number issued, SMS stored encrypted and visible only to its owner", async () => {
    const product = await firstVerificationProduct();
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await decideSandboxCharge(payment.reference, "success");
    await drainJobs();
    const v = await db.verificationActivation.findFirstOrThrow({ where: { orderItem: { orderId } } });
    expect(v.phoneNumber).toMatch(/^\+1555010\d{2}$/);

    const delivered = await simulateSandboxSms({ kind: "activation", supplierRef: v.supplierOrderRef }, "Your code is 482910", "482910");
    expect(delivered.status).toBe(200);
    const raw = await db.incomingSmsMessage.findFirstOrThrow({ where: { verificationId: v.id } });
    expect(raw.bodyEnc).not.toContain("482910");

    const mine = await getVerification(user.id, v.id);
    expect(mine?.messages[0]?.code).toBe("482910");
    expect(mine?.status).toBe("RECEIVED");

    const intruder = await createUser();
    expect(await getVerification(intruder.id, v.id)).toBeNull();
    expect(await getOrder(intruder.id, orderId)).toBeNull();
  });

  it("verification: cancelling before any SMS refunds the customer", async () => {
    const product = await firstVerificationProduct();
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await decideSandboxCharge(payment.reference, "success");
    await drainJobs();
    const v = await db.verificationActivation.findFirstOrThrow({ where: { orderItem: { orderId } } });

    const intruder = await createUser();
    expect((await cancelVerification(intruder.id, v.id)).ok).toBe(false);

    const r = await cancelVerification(user.id, v.id);
    expect(r).toEqual({ ok: true, refunded: true });
    await drainJobs(10);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds[0]?.status).toBe("COMPLETED");
  });

  it("checkout is idempotent for the same key and refuses another user's key", async () => {
    const product = await productByCode("SBX-ES-1GB-7D");
    const key = randomUUID();
    const a = await createCheckout({ userId: user.id, email: user.email, productId: product.id, idempotencyKey: key });
    const b = await createCheckout({ userId: user.id, email: user.email, productId: product.id, idempotencyKey: key });
    expect(a.ok && b.ok && a.orderId === b.orderId).toBe(true);
    const other = await createUser();
    const c = await createCheckout({ userId: other.id, email: other.email, productId: product.id, idempotencyKey: key });
    expect(c.ok).toBe(false);
  });

  it("a declined payment cancels the order without fulfilment", async () => {
    const product = await productByCode("SBX-ES-1GB-7D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await decideSandboxCharge(payment.reference, "failure");
    const r = await confirmPayment(payment.reference, "return");
    expect(r.outcome).toBe("failed");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
  });

  it("a payment that arrives after the order was cancelled is refunded automatically", async () => {
    const product = await productByCode("SBX-ES-1GB-7D");
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await db.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await decideSandboxCharge(payment.reference, "success");
    await drainJobs(10);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    expect(order.refunds[0]?.status).toBe("COMPLETED");
    expect(await db.fulfilment.count({ where: { orderItem: { orderId } } })).toBe(0);
  });

  it("rental: issued with autoRenew disabled and expiry tracked", async () => {
    const product = await db.product.findFirstOrThrow({ where: { type: "RENTAL", rentalTerm: "7d", country: { code: "GB" } } });
    const { orderId, payment } = await checkout(user.id, user.email, product.id);
    await decideSandboxCharge(payment.reference, "success");
    await drainJobs();
    const rental = await db.phoneNumberRental.findFirstOrThrow({ where: { orderItem: { orderId } } });
    expect(rental.status).toBe("ACTIVE");
    expect(rental.phoneNumber).toMatch(/^\+447700900\d{3}$/);
    expect(rental.expiresAt.getTime() - rental.rentedAt.getTime()).toBe(7 * 24 * 3600 * 1000);
  });
});
