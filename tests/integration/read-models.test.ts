import { beforeAll, describe, expect, it } from "vitest";
import { adminOverview, getOrderForStaff, integrationsStatus, listAuditLogs, listOrders, listPayments, listProducts, listRefunds, listUsers, orderStatusCounts, pages } from "@/server/admin/queries";
import { adminTrends, profitReport } from "@/server/admin/reports";
import {
  getEsimDestination,
  getEsimPlan,
  getRentalOffers,
  getVerificationCountry,
  getVerificationService,
  listEsimDestinations,
  listPopularServices,
  listRentalCountries,
  listVerificationCountries,
} from "@/server/catalog/queries";
import { getDashboardSummary, isUuid, listEsims, listOrders as listCustomerOrders } from "@/server/customer/queries";
import { db } from "@/server/db";
import { runRetention } from "@/server/maintenance";
import { clientIp, consumeRateLimit, enforceRateLimit, purgeExpiredRateLimits, RateLimitError } from "@/server/rate-limit";
import { getAllSettings, getSetting, setSetting } from "@/server/settings";
import { checkoutAndPay, createUser, drainJobs, resetDatabase } from "./helpers";

const HOUR = 3600 * 1000;

describe("public catalogue (fresh database, refreshed on demand from the sandbox supplier)", () => {
  beforeAll(async () => {
    await resetDatabase();
    await db.pricingRule.create({ data: { name: "Test global margin", markupPercent: "25", markupFixed: "0", minProfit: "0.30", currency: "USD" } });
  });

  it("loads eSIM destinations on first visit, prices them once their plans load, and does not resync while fresh", async () => {
    const spain = (await listEsimDestinations()).find((d) => d.slug === "spain");
    expect(spain).toMatchObject({ locationCode: "ES", kind: "COUNTRY" });
    // Plans (and so "from" prices) load per destination: on first open, or via the hourly catalogue sync.
    expect(spain!.fromPrice).toBeNull();
    await getEsimDestination("spain");
    const priced = (await listEsimDestinations()).find((d) => d.slug === "spain");
    expect(Number(priced!.fromPrice!.amount)).toBeGreaterThan(0);

    const syncs = await db.catalogSyncLog.count();
    await listEsimDestinations({ q: "spa" });
    expect(await db.catalogSyncLog.count()).toBe(syncs);
    expect((await listEsimDestinations({ q: "zzz-none" })).length).toBe(0);
  });

  it("shows plans as data-only with server-side prices, and hides plans staff disabled", async () => {
    const result = await getEsimPlan("spain", "sbx-es-1gb-7d");
    expect(result?.plan).toMatchObject({ includesPhoneNumber: false, includesSms: false, includesVoice: false });
    expect(result?.plan.price?.currency).toBe("USD");
    expect(result?.related.length).toBeGreaterThan(0);

    await db.product.update({ where: { id: result!.plan.id }, data: { isVisible: false } });
    expect(await getEsimPlan("spain", "sbx-es-1gb-7d")).toBeNull();
    await db.product.update({ where: { id: result!.plan.id }, data: { isVisible: true } });

    expect(await getEsimDestination("atlantis")).toBeNull();
    expect(await getEsimPlan("spain", "no-such-plan")).toBeNull();
  });

  it("shows a product as unavailable instead of guessing when no pricing rule applies", async () => {
    await db.pricingRule.updateMany({ data: { isActive: false } });
    const result = await getEsimPlan("spain", "sbx-es-1gb-7d");
    expect(result?.plan.price).toBeNull();
    await db.pricingRule.updateMany({ data: { isActive: true } });
  });

  it("lists verification countries, popular services and priced offers", async () => {
    const countries = await listVerificationCountries();
    expect(countries.map((c) => c.code)).toEqual(expect.arrayContaining(["US", "GB"]));
    expect((await listVerificationCountries("united")).map((c) => c.code).sort()).toEqual(["GB", "US"]);

    const services = await listPopularServices(3);
    expect(services).toHaveLength(3);
    expect(services.every((s) => s.popular)).toBe(true);

    const us = await getVerificationCountry("united-states");
    const google = us?.services.find((s) => s.slug === "google");
    expect(google?.totalStock).toBeGreaterThan(0);
    const prices = google!.offers.map((o) => Number(o.price!.amount));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Number(google!.fromPrice!.amount)).toBe(prices[0]);

    expect((await getVerificationService("united-states", "google"))?.service?.slug).toBe("google");
    expect((await getVerificationService("united-states", "no-such-service"))?.service).toBeNull();
    expect(await getVerificationCountry("atlantis")).toBeNull();
  });

  it("lists rental countries and priced rental offers", async () => {
    expect((await listRentalCountries()).map((c) => c.code)).toContain("GB");
    const offers = await getRentalOffers("gb");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.price !== null)).toBe(true);
    expect(await getRentalOffers("ZZ")).toEqual([]);
  });
});

describe("profit report, staff and customer read models", () => {
  let fulfilled: Awaited<ReturnType<typeof checkoutAndPay>>;
  let refunded: Awaited<ReturnType<typeof checkoutAndPay>>;

  beforeAll(async () => {
    fulfilled = await checkoutAndPay({ supplierProductCode: "SBX-ES-1GB-7D" });
    refunded = await checkoutAndPay({ supplierProductCode: "SBX-ES-TEST-FAIL" });
    await drainJobs(10);
  });

  it("reports sales, refunds, supplier cost and contribution exactly from stored transactions", async () => {
    const r = await profitReport(new Date(Date.now() - HOUR), new Date(Date.now() + HOUR));
    const [ok, failed] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: fulfilled.orderId }, include: { items: { include: { fulfilment: true } } } }),
      db.order.findUniqueOrThrow({ where: { id: refunded.orderId } }),
    ]);
    const okTotal = Number(ok.total);
    const failedTotal = Number(failed.total);
    const cost = Number(ok.items[0]!.fulfilment!.supplierCost);

    expect(failed.status).toBe("REFUNDED");
    expect(r).toMatchObject({ currency: "USD", paidOrders: 2, fulfilledOrders: 1, failedOrders: 1 });
    expect(Number(r.grossSales)).toBeCloseTo(okTotal + failedTotal, 4);
    expect(Number(r.refunds)).toBeCloseTo(failedTotal, 4);
    expect(Number(r.netSales)).toBeCloseTo(okTotal, 4);
    expect(Number(r.supplierCost)).toBeCloseTo(cost, 4);
    expect(Number(r.grossProfit)).toBeCloseTo(okTotal - cost, 4);
    expect(Number(r.netContribution)).toBeCloseTo(okTotal - cost - Number(r.gatewayFees), 4);
    expect(r.byCategory).toEqual([{ category: "ESIM", orders: 2, sales: expect.any(String) }]);
    expect(r.byCountry[0]).toMatchObject({ country: "Spain", code: "ES", kind: "COUNTRY", orders: 2 });
    expect(r.byDay).toHaveLength(1);
    expect(r.byMonth).toHaveLength(1);
  });

  it("charts paid orders and sales per day for the admin overview, with empty days as zero", async () => {
    const t = await adminTrends(14);
    const [ok, failed] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: fulfilled.orderId } }),
      db.order.findUniqueOrThrow({ where: { id: refunded.orderId } }),
    ]);
    expect(t.series).toHaveLength(14);
    expect(t.series.at(-1)).toMatchObject({ orders: 2 });
    expect(t.series.slice(0, -1).every((p) => p.orders === 0)).toBe(true);
    expect(t.totalOrders).toBe(2);
    expect(t.totalSales).toBeCloseTo(Number(ok.total) + Number(failed.total), 4);
  });

  it("reports nothing for a period without orders", async () => {
    const r = await profitReport(new Date("2020-01-01"), new Date("2020-02-01"));
    expect(r).toMatchObject({ grossSales: "0", refunds: "0", paidOrders: 0, byDay: [] });
  });

  it("gives staff searchable, filtered order, user, payment and refund lists", async () => {
    const all = await listOrders({});
    expect(all.total).toBe(2);
    const order = await db.order.findUniqueOrThrow({ where: { id: fulfilled.orderId } });
    expect((await listOrders({ q: order.number })).items.map((o) => o.id)).toEqual([order.id]);
    expect((await listOrders({ q: fulfilled.payment.reference })).total).toBe(1);
    expect((await listOrders({ status: "REFUNDED" })).items.map((o) => o.id)).toEqual([refunded.orderId]);
    expect((await listOrders({ status: "NOT_A_STATUS" })).total).toBe(2);
    const counts = await orderStatusCounts();
    expect(counts.total).toBe(2);
    expect(counts.byStatus).toEqual(expect.arrayContaining([{ status: "FULFILLED", count: 1 }, { status: "REFUNDED", count: 1 }]));
    expect((await getOrderForStaff(order.id))?.id).toBe(order.id);

    expect((await listUsers({ q: fulfilled.user.email })).total).toBe(1);
    expect((await listPayments({})).total).toBeGreaterThanOrEqual(2);
    expect((await listRefunds({})).total).toBe(1);
    expect((await listProducts({ type: "ESIM" })).total).toBeGreaterThan(0);
    expect((await listAuditLogs({})).total).toBeGreaterThan(0);
    expect(pages(0)).toBe(1);
    expect(pages(26)).toBe(2);

    const overview = await adminOverview();
    expect(overview).toMatchObject({ review: 0, pendingRefunds: 0, uncertain: 0, todayOrders: 2 });
    await expect(integrationsStatus()).resolves.toBeTruthy();
  });

  it("shows customers only their own orders and eSIMs", async () => {
    expect((await listCustomerOrders(fulfilled.user.id)).items.map((o) => o.id)).toEqual([fulfilled.orderId]);
    expect(await listEsims(fulfilled.user.id)).toHaveLength(1);
    expect(await listEsims(refunded.user.id)).toHaveLength(0);
    const summary = await getDashboardSummary(fulfilled.user.id);
    expect(summary.currentEsims).toHaveLength(1);
    expect(summary.currentEsims[0]?.orderItem.product.destination?.country?.code).toBe("ES");
    expect((await getDashboardSummary(refunded.user.id)).currentEsims).toHaveLength(0);
    expect(isUuid(fulfilled.orderId)).toBe(true);
    expect(isUuid("1 OR 1=1")).toBe(false);
  });
});

describe("settings and rate limits", () => {
  it("falls back to defaults, validates writes and ignores corrupted stored values", async () => {
    const admin = await createUser({ role: "admin" });
    expect(await getSetting("orders.paymentWindowMinutes")).toBe(60);
    expect(await setSetting("orders.paymentWindowMinutes", 30, admin.id)).toBe(30);
    expect(await getSetting("orders.paymentWindowMinutes")).toBe(30);
    await expect(setSetting("orders.paymentWindowMinutes", 1, admin.id)).rejects.toThrow();

    await db.systemSetting.update({ where: { key: "orders.paymentWindowMinutes" }, data: { value: "not a number" } });
    expect(await getSetting("orders.paymentWindowMinutes")).toBe(60);
    expect((await getAllSettings())["store.purchasesEnabled"]).toBe(true);
  });

  it("blocks after the limit within a window and reports when to retry", async () => {
    const key = `test:${Date.now()}`;
    expect((await consumeRateLimit(key, 2, 60)).ok).toBe(true);
    expect((await consumeRateLimit(key, 2, 60)).ok).toBe(true);
    const blocked = await consumeRateLimit(key, 2, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    await expect(enforceRateLimit(key, 2, 60)).rejects.toBeInstanceOf(RateLimitError);

    await db.rateLimitBucket.create({ data: { key: `expired:${key}`, count: 1, windowStart: new Date(Date.now() - 2 * HOUR), expiresAt: new Date(Date.now() - HOUR) } });
    expect(await purgeExpiredRateLimits()).toBeGreaterThanOrEqual(1);
  });

  it("takes the client IP from the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("retention (runs last: it deletes data)", () => {
  it("removes abandoned orders and expired data but keeps every financial record", async () => {
    const user = await createUser();
    const product = await db.product.findFirstOrThrow({ where: { supplierProductCode: "SBX-ES-1GB-7D" } });
    const { createCheckout } = await import("@/server/orders/checkout");
    const abandoned = await createCheckout({ userId: user.id, email: user.email, productId: product.id, idempotencyKey: `abandoned-${user.id}` });
    if (!abandoned.ok) throw new Error(abandoned.error);
    await db.order.update({ where: { id: abandoned.orderId }, data: { status: "CANCELLED" } });

    const before = {
      ledger: await db.ledgerEntry.count(),
      refunds: await db.refund.count(),
      paidPayments: await db.payment.count({ where: { status: "SUCCEEDED" } }),
    };
    const result = await runRetention(new Date(Date.now() + 3 * 365 * 24 * HOUR));

    expect(result.abandonedOrdersDeleted).toBe(1);
    expect(await db.order.findUnique({ where: { id: abandoned.orderId } })).toBeNull();
    expect(await db.ledgerEntry.count()).toBe(before.ledger);
    expect(await db.refund.count()).toBe(before.refunds);
    expect(await db.payment.count({ where: { status: "SUCCEEDED" } })).toBe(before.paidPayments);
    expect(result.auditLogsDeleted).toBeGreaterThan(0);
  });
});
