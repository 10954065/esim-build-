import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { applyEsimWebhook, fulfilOrderItem, linkSupplierOrder, retryFulfilment, sweepPreparingEsims } from "@/server/fulfilment/service";
import { createCheckout } from "@/server/orders/checkout";
import { __resetSupplierAdapterForTests, type SupplierAdapter } from "@/server/providers/supplier";
import { SupplierError } from "@/server/providers/supplier/errors";
import { createSandboxAdapter } from "@/server/providers/supplier/sandbox/adapter";
import type { ActivationInfo, EsimOrderInfo, RentalInfo } from "@/server/providers/supplier/types";
import { checkoutAndPay, createUser, drainJobs, ledgerIsBalanced, resetDatabase, seedPricingAndCatalog } from "./helpers";

/**
 * Fulfilment failure modes the sandbox supplier cannot produce on its own (lost responses,
 * ambiguous matches, operator errors, slow eSIM preparation) are simulated by wrapping the
 * sandbox adapter. The supplier is never called twice for one paid item unless it definitely failed.
 */

const sandbox = createSandboxAdapter({ signingSecret: process.env.SANDBOX_SIGNING_SECRET, priceCurrency: "USD" });

function useSupplier(overrides: { esim?: Partial<SupplierAdapter["esim"]>; verification?: Partial<SupplierAdapter["verification"]>; rentals?: Partial<SupplierAdapter["rentals"]>; mode?: SupplierAdapter["mode"] }) {
  __resetSupplierAdapterForTests({
    ...sandbox,
    mode: overrides.mode ?? sandbox.mode,
    esim: { ...sandbox.esim, ...overrides.esim },
    verification: { ...sandbox.verification, ...overrides.verification },
    rentals: { ...sandbox.rentals, ...overrides.rentals },
  });
}

const lostResponse = () => new SupplierError("UNCERTAIN", "Supplier request did not complete (network error or timeout)");
const page = <T>(items: T[], p: number, limit: number) => ({ items, total: items.length, page: p, limit });

async function paidOrder(where: Prisma.ProductWhereInput) {
  const o = await checkoutAndPay(where);
  const fulfilment = await db.fulfilment.findFirstOrThrow({ where: { orderItem: { orderId: o.orderId } } });
  return { ...o, fulfilmentId: fulfilment.id };
}

const paidEsimOrder = (packageCode = "SBX-ES-1GB-7D") => paidOrder({ supplierProductCode: packageCode });
const orderStatus = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;
const fulfilmentOf = (id: string) => db.fulfilment.findUniqueOrThrow({ where: { id } });

describe("fulfilment failure handling (real database)", () => {
  let admin: { id: string; role: string };

  beforeAll(async () => {
    await resetDatabase();
    await seedPricingAndCatalog();
    const u = await createUser({ role: "admin" });
    admin = { id: u.id, role: "admin" };
  });

  afterEach(() => {
    __resetSupplierAdapterForTests();
  });

  it("lost response for an eSIM the supplier did create → recovered from the supplier's order list, bought once", async () => {
    const created: EsimOrderInfo[] = [];
    let purchases = 0;
    useSupplier({
      esim: {
        async orderEsim(input) {
          purchases++;
          created.push(await sandbox.esim.orderEsim(input));
          throw lostResponse();
        },
        async listEsimOrders(p, limit) {
          return page(created, p, limit);
        },
      },
    });
    const { user, orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();

    expect(purchases).toBe(1);
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    const f = await fulfilmentOf(fulfilmentId);
    expect(f.status).toBe("SUCCEEDED");
    expect(f.supplierOrderRef).toBe(created[0]!.supplierOrderId);
    expect(await db.esimActivation.count({ where: { userId: user.id } })).toBe(1);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("lost response with no matching supplier order → staff review after repeated checks, no retry and no refund", async () => {
    let purchases = 0;
    useSupplier({
      esim: {
        async orderEsim() {
          purchases++;
          throw lostResponse();
        },
      },
    });
    const { orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs(10);

    expect(purchases).toBe(1);
    expect(await orderStatus(orderId)).toBe("NEEDS_REVIEW");
    expect((await fulfilmentOf(fulfilmentId)).lastErrorCode).toBe("RECONCILE_NONE");
    expect(await db.job.count({ where: { type: "reconcile-fulfilment", payload: { path: ["fulfilmentId"], equals: fulfilmentId } } })).toBe(3);
    expect(await db.refund.count({ where: { orderId } })).toBe(0);
  });

  it("several possible matches → review, then staff link the verified supplier order", async () => {
    let candidates: EsimOrderInfo[] = [];
    useSupplier({
      esim: {
        async orderEsim() {
          throw lostResponse();
        },
        async listEsimOrders(p, limit) {
          if (candidates.length === 0) {
            const real = await sandbox.esim.orderEsim({ packageCode: "SBX-ES-1GB-7D", quantity: 1 });
            candidates = [real, { ...real, supplierOrderId: `${real.supplierOrderId}-other` }];
          }
          return page(candidates, p, limit);
        },
      },
    });
    const { user, orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();
    expect(await orderStatus(orderId)).toBe("NEEDS_REVIEW");
    expect((await fulfilmentOf(fulfilmentId)).lastErrorCode).toBe("RECONCILE_AMBIGUOUS");

    await linkSupplierOrder(fulfilmentId, candidates[0]!.supplierOrderId, admin, "Matched in the supplier dashboard");
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect(await db.esimActivation.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: fulfilmentId, action: "fulfilment.manual_link" } })).toBe(1);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("manual linking refuses another package or a supplier order that belongs to a different order", async () => {
    const first = await paidEsimOrder();
    await drainJobs();
    const takenRef = (await fulfilmentOf(first.fulfilmentId)).supplierOrderRef!;

    useSupplier({
      esim: {
        async orderEsim() {
          throw lostResponse();
        },
      },
    });
    const second = await paidEsimOrder();
    await drainJobs(10);
    expect(await orderStatus(second.orderId)).toBe("NEEDS_REVIEW");

    await expect(linkSupplierOrder(second.fulfilmentId, takenRef, admin, "Wrong order picked")).rejects.toThrow("already linked to another order");
    const otherPackage = await sandbox.esim.orderEsim({ packageCode: "SBX-ES-3GB-15D", quantity: 1 });
    await expect(linkSupplierOrder(second.fulfilmentId, otherPackage.supplierOrderId, admin, "Wrong package")).rejects.toThrow("does not match the purchased package");
    expect(await orderStatus(second.orderId)).toBe("NEEDS_REVIEW");
    expect(await orderStatus(first.orderId)).toBe("FULFILLED");
  });

  it("operator problem (supplier balance) → review without refund; staff retry after topping up", async () => {
    useSupplier({
      esim: {
        async orderEsim() {
          throw new SupplierError("INSUFFICIENT_BALANCE", "Insufficient balance", { httpStatus: 402 });
        },
      },
    });
    const { orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();
    expect(await orderStatus(orderId)).toBe("NEEDS_REVIEW");
    expect((await fulfilmentOf(fulfilmentId)).lastErrorCode).toBe("INSUFFICIENT_BALANCE");
    expect(await db.refund.count({ where: { orderId } })).toBe(0);

    __resetSupplierAdapterForTests();
    await retryFulfilment(fulfilmentId, admin, "Supplier balance topped up");
    await drainJobs();
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect(await db.auditLog.count({ where: { entityId: fulfilmentId, action: "fulfilment.retry" } })).toBe(1);
  });

  it("a temporary supplier error is retried and then succeeds", async () => {
    let calls = 0;
    useSupplier({
      esim: {
        async orderEsim(input) {
          calls++;
          if (calls === 1) throw new SupplierError("RATE_LIMITED", "Too many requests", { httpStatus: 429 });
          return sandbox.esim.orderEsim(input);
        },
      },
    });
    const { orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();
    expect(calls).toBe(2);
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect((await fulfilmentOf(fulfilmentId)).attempts).toBe(2);
  });

  it("an order that was already refunded cannot be resubmitted to the supplier", async () => {
    const { orderId, fulfilmentId } = await paidEsimOrder("SBX-ES-TEST-FAIL");
    await drainJobs(10);
    expect(await orderStatus(orderId)).toBe("REFUNDED");
    await expect(retryFulfilment(fulfilmentId, admin, "Try again")).rejects.toThrow("already has a refund");
  });

  it("an eSIM still being prepared completes on the next sweep", async () => {
    useSupplier({
      esim: {
        async orderEsim(input) {
          const o = await sandbox.esim.orderEsim(input);
          return { ...o, ready: false, lifecycle: "PREPARING", profiles: o.profiles.map((p) => ({ ...p, activationCode: null })) };
        },
      },
    });
    const { user, orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();
    expect((await fulfilmentOf(fulfilmentId)).status).toBe("AWAITING_SUPPLIER");
    expect(await orderStatus(orderId)).toBe("FULFILLING");
    expect((await db.esimActivation.findFirstOrThrow({ where: { userId: user.id } })).status).toBe("PREPARING");
    expect(await ledgerIsBalanced()).toBe(true);

    __resetSupplierAdapterForTests();
    expect(await sweepPreparingEsims()).toBe(1);
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect((await db.esimActivation.findFirstOrThrow({ where: { userId: user.id } })).status).toBe("READY");
  });

  it("a supplier webhook reporting a failed eSIM preparation refunds the customer", async () => {
    useSupplier({
      esim: {
        async orderEsim(input) {
          const o = await sandbox.esim.orderEsim(input);
          return { ...o, ready: false, lifecycle: "PREPARING" };
        },
      },
    });
    const { orderId, fulfilmentId } = await paidEsimOrder();
    await drainJobs();
    const ref = (await fulfilmentOf(fulfilmentId)).supplierOrderRef!;

    await applyEsimWebhook({ ...(await sandbox.esim.getEsimOrder(ref)), ready: false, lifecycle: "FAILED" });
    await drainJobs();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds.map((r) => r.status)).toEqual(["COMPLETED"]);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("webhooks for unknown supplier orders are ignored", async () => {
    const stray = await sandbox.esim.orderEsim({ packageCode: "SBX-ES-1GB-7D", quantity: 1 });
    await expect(applyEsimWebhook(stray)).resolves.toBeUndefined();
  });

  it("refuses to fulfil a demo order with a live supplier, without claiming the item", async () => {
    const user = await createUser();
    const product = await db.product.findFirstOrThrow({ where: { supplierProductCode: "SBX-ES-1GB-7D" } });
    const r = await createCheckout({ userId: user.id, email: user.email, productId: product.id, idempotencyKey: randomUUID() });
    if (!r.ok) throw new Error(r.error);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: r.orderId } });

    useSupplier({ mode: "LIVE" });
    await expect(fulfilOrderItem(item.id)).rejects.toThrow("sandbox flag does not match");
    const f = await db.fulfilment.findUnique({ where: { orderItemId: item.id } });
    expect(f?.status ?? "PENDING").toBe("PENDING");
  });

  it("lost response for a verification number → recovered from recent activations", async () => {
    const created: ActivationInfo[] = [];
    useSupplier({
      verification: {
        async orderActivation(input) {
          created.push(await sandbox.verification.orderActivation(input));
          throw lostResponse();
        },
        async listRecentActivations(p, limit) {
          return page(created, p, limit);
        },
      },
    });
    const { user, orderId } = await paidOrder({ type: "VERIFICATION", isActive: true, stockCount: { gt: 0 }, service: { slug: { not: "demo-fail" } } });
    await drainJobs();
    expect(created).toHaveLength(1);
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect((await db.verificationActivation.findFirstOrThrow({ where: { userId: user.id } })).supplierOrderRef).toBe(created[0]!.supplierOrderId);
  });

  it("lost response for a rental → recovered from the supplier's number list", async () => {
    const created: RentalInfo[] = [];
    useSupplier({
      rentals: {
        async orderRental(input) {
          created.push(await sandbox.rentals.orderRental(input));
          throw lostResponse();
        },
        async listRentals(p, limit) {
          return page(created, p, limit);
        },
      },
    });
    const { user, orderId } = await paidOrder({ type: "RENTAL", rentalTerm: "7d", country: { code: "GB" } });
    await drainJobs();
    expect(created).toHaveLength(1);
    expect(await orderStatus(orderId)).toBe("FULFILLED");
    expect((await db.phoneNumberRental.findFirstOrThrow({ where: { userId: user.id } })).supplierNumberId).toBe(created[0]!.supplierNumberId);
  });
});
