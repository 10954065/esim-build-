import { describe, expect, it } from "vitest";
import { SupplierError } from "../errors";
import { createSms1001Adapter } from "./adapter";

// Payload shapes follow the documented examples at https://www.1001sms.com/api-docs.

type Call = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown> | null };

function adapterWith(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/v1/, "");
    calls.push({ method, path, query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : null });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response(JSON.stringify({ success: false, error: `no route ${key}` }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: routes[key] }), { status: 200 });
  }) as typeof fetch;
  const adapter = createSms1001Adapter({ baseUrl: "https://api.test/v1", apiKey: "k_test", timeoutMs: 1000, fetchImpl, webhookSecret: "whsec", priceCurrency: "USD" });
  return { adapter, calls };
}

const esimOrder = {
  id: "eord_9x1",
  status: "ALLOCATED",
  packageCode: "ES_1_7",
  packageName: "Spain 1GB · 7 days",
  days: 7,
  locationCode: "ES",
  quantity: 1,
  price: "4.20",
  ready: true,
  profiles: [{ id: "prof_1", iccid: "8943100000000000001", activationCode: "LPA:1$rsp.example.com$ABC", totalVolume: 1073741824, usedVolume: 0 }],
  lifecycle: "ready",
};

const activation = {
  id: "ord_123",
  phoneNumber: "+14155552671",
  countryCode: "us",
  serviceId: "google",
  serviceName: "Google",
  operatorName: "virtual9",
  price: 0.5,
  status: "RENTED",
  provider: "EXTRA",
  expiresAt: "2026-02-01T12:15:00.000Z",
  rentedAt: "2026-02-01T12:00:00.000Z",
};

const rental = {
  id: "num_8f2k",
  phoneNumber: "+447700900123",
  country: "gb",
  type: "unlimited",
  term: "7d",
  days: 7,
  status: "ACTIVE",
  price: 3,
  autoRenew: false,
  rentedAt: "2026-09-22T10:00:00.000Z",
  expiresAt: "2026-09-29T10:00:00.000Z",
};

describe("1001SMS adapter: identity", () => {
  it("reports itself as the live supplier with the configured price currency", () => {
    const { adapter } = adapterWith({});
    expect(adapter).toMatchObject({ code: "1001sms", mode: "LIVE", priceCurrency: "USD" });
  });
});

describe("1001SMS adapter: eSIMs", () => {
  it("lists destinations and packages for a location", async () => {
    const { adapter, calls } = adapterWith({
      "GET /esims/destinations": { count: 1, destinations: [{ locationCode: "ES", name: "Spain", kind: "country", packageCount: 3, fromPrice: 1.9 }] },
      "GET /esims/packages": { packages: [{ packageCode: "ES_1_7", name: "Spain 1GB", locationCode: "ES", locationName: "Spain", volumeBytes: "1073741824", durationDays: 7, price: 4.2 }] },
    });
    const destinations = await adapter.esim.listDestinations();
    expect(destinations).toHaveLength(1);
    expect(destinations[0]).toMatchObject({ locationCode: "ES", name: "Spain", kind: "COUNTRY" });
    const packages = await adapter.esim.listPackages("ES");
    expect(calls[1]!.query.get("location")).toBe("ES");
    expect(packages[0]).toMatchObject({ packageCode: "ES_1_7", cost: "4.2", includesPhoneNumber: false });
  });

  it("orders an eSIM, sending days only when given", async () => {
    const { adapter, calls } = adapterWith({ "POST /esims/order": esimOrder });
    const order = await adapter.esim.orderEsim({ packageCode: "ES_1_7", quantity: 1 });
    expect(calls[0]!.body).toEqual({ packageCode: "ES_1_7", quantity: 1 });
    expect(order).toMatchObject({ supplierOrderId: "eord_9x1", cost: "4.20", lifecycle: "READY" });
    expect(order.profiles[0]?.activationCode).toBe("LPA:1$rsp.example.com$ABC");
    await adapter.esim.orderEsim({ packageCode: "ES_UNL", quantity: 1, days: 5 });
    expect(calls[1]!.body).toEqual({ packageCode: "ES_UNL", quantity: 1, days: 5 });
  });

  it("fetches an order with an optional refresh and encodes the id", async () => {
    const { adapter, calls } = adapterWith({ "GET /esims/orders/eord%2F1": esimOrder });
    await adapter.esim.getEsimOrder("eord/1", { refresh: true });
    expect(calls[0]!.path).toBe("/esims/orders/eord%2F1");
    expect(calls[0]!.query.get("refresh")).toBe("1");
  });

  it("drops malformed list items instead of failing reconciliation, and caps the page size", async () => {
    const { adapter, calls } = adapterWith({ "GET /esims/orders": { orders: [esimOrder, { id: "broken" }], total: 2, page: 1, limit: 100 } });
    const page = await adapter.esim.listEsimOrders(1, 500);
    expect(calls[0]!.query.get("limit")).toBe("100");
    expect(page.items.map((o) => o.supplierOrderId)).toEqual(["eord_9x1"]);
    expect(page).toMatchObject({ total: 2, page: 1, limit: 100 });
  });
});

describe("1001SMS adapter: verification numbers", () => {
  it("lists countries (upper-cased codes) and services", async () => {
    const { adapter } = adapterWith({
      "GET /informative/countries": [{ name: "United States", code: "us", slug: "united-states", phoneCode: "+1" }],
      "GET /informative/services": [{ name: "Google", slug: "google", popular: true, iconPath: "/i/google.svg" }],
    });
    await expect(adapter.verification.listCountries()).resolves.toEqual([{ code: "US", name: "United States", slug: "united-states", phoneCode: "+1", continent: null }]);
    await expect(adapter.verification.listServices()).resolves.toEqual([{ slug: "google", name: "Google", iconUrl: "/i/google.svg", popular: true }]);
  });

  it("gets offers for one service and for a whole country", async () => {
    const operator = { operator: "virtual9", price: "0.35", count: 120, deliverability: 92.4, provider: "STANDARD" };
    const { adapter, calls } = adapterWith({ "GET /informative/pricing": { services: [{ service: "google", serviceName: "Google", operators: [operator] }], operators: [operator] } });
    const one = await adapter.verification.getOffers({ countryCode: "us", serviceSlug: "google" });
    expect(calls[0]!.query.get("service")).toBe("google");
    expect(one).toEqual([{ countryCode: "US", serviceSlug: "google", serviceName: "google", providerTier: "STANDARD", operator: "virtual9", cost: "0.35", stock: 120, deliverability: 92 }]);
    const all = await adapter.verification.getOffers({ countryCode: "us" });
    expect(calls[1]!.query.has("service")).toBe(false);
    expect(all[0]).toMatchObject({ serviceSlug: "google", serviceName: "Google" });
  });

  it("orders an activation as a one-time purchase", async () => {
    const { adapter, calls } = adapterWith({ "POST /activations/order": activation });
    const a = await adapter.verification.orderActivation({ countryCode: "US", serviceSlug: "google", providerTier: "EXTRA", operator: "virtual9" });
    expect(calls[0]!.body).toEqual({ country: "US", service: "google", provider: "EXTRA", purchaseType: "activation", operator: "virtual9" });
    expect(a).toMatchObject({ supplierOrderId: "ord_123", countryCode: "US", state: "WAITING", cost: "0.5" });
  });

  it("merges fresh messages from the check endpoint into the activation", async () => {
    const { adapter, calls } = adapterWith({
      "GET /activations/ord_123": activation,
      "POST /activations/check": {
        hasMessage: true,
        status: "RENTED",
        messages: [{ id: "m1", sender: "Google", message: "G-482910 is your code", code: "482910", receivedAt: "2026-02-01T12:03:00.000Z" }],
      },
    });
    const a = await adapter.verification.getActivation("ord_123");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /activations/ord_123", "POST /activations/check"]);
    expect(calls[1]!.body).toEqual({ orderId: "ord_123" });
    expect(a.state).toBe("RECEIVED");
    expect(a.messages[0]).toMatchObject({ supplierMessageId: "m1", text: "G-482910 is your code", code: "482910" });
  });

  it.each([
    [{ id: "ord_123", status: "REFUNDED", refundAmount: 0.5 }, { state: "REFUNDED", refundAmount: "0.5" }],
    [{ id: "ord_123", status: "CANCELLED" }, { state: "CANCELLED", refundAmount: "0" }],
  ])("maps a cancellation result %#", async (reply, expected) => {
    const { adapter } = adapterWith({ "POST /activations/cancel": reply });
    await expect(adapter.verification.cancelActivation("ord_123")).resolves.toMatchObject(expected);
  });

  it("lists recent activations, skipping malformed entries", async () => {
    const { adapter } = adapterWith({ "GET /activations/history": { orders: [activation, { id: 1 }], total: 2, page: 1, limit: 50 } });
    const page = await adapter.verification.listRecentActivations(1, 50);
    expect(page.items.map((a) => a.supplierOrderId)).toEqual(["ord_123"]);
  });
});

describe("1001SMS adapter: rentals", () => {
  it("lists rental countries and pricing, dropping services without usable terms", async () => {
    const { adapter } = adapterWith({
      "GET /numbers/countries": [{ code: "gb", name: "United Kingdom", types: ["unlimited", "service"] }],
      "GET /numbers/pricing": {
        unlimited: [{ term: "7d", days: 7, price: 3 }],
        services: [
          { service: "whatsapp", name: "WhatsApp", terms: [{ term: "30d", days: 30, price: "4.5" }] },
          { service: "odd", terms: [{ unexpected: true }] },
        ],
      },
    });
    await expect(adapter.rentals.listRentalCountries()).resolves.toEqual([{ code: "GB", name: "United Kingdom", phoneCode: null, types: ["unlimited", "service"] }]);
    const pricing = await adapter.rentals.getRentalPricing("gb");
    expect(pricing.countryCode).toBe("GB");
    expect(pricing.unlimited).toEqual([{ term: "7d", days: 7, hours: null, cost: "3" }]);
    expect(pricing.services.map((s) => s.serviceSlug)).toEqual(["whatsapp"]);
  });

  it("checks availability", async () => {
    const { adapter, calls } = adapterWith({ "GET /numbers/availability": { count: 4, inStock: true } });
    await expect(adapter.rentals.getRentalAvailability("GB", "7d")).resolves.toEqual({ inStock: true, count: 4 });
    expect(calls[0]!.query.get("term")).toBe("7d");
  });

  it("never lets the supplier auto-renew a rental", async () => {
    const { adapter, calls } = adapterWith({ "POST /numbers/order": rental });
    const r = await adapter.rentals.orderRental({ countryCode: "GB", term: "7d", rentalType: "unlimited" });
    expect(calls[0]!.body).toEqual({ country: "GB", term: "7d", type: "unlimited", autoRenew: false });
    expect(r).toMatchObject({ supplierNumberId: "num_8f2k", countryCode: "GB", state: "ACTIVE", cost: "3" });
  });

  it("gets, cancels and lists rentals", async () => {
    const { adapter, calls } = adapterWith({
      "GET /numbers/num_8f2k": { ...rental, status: "EXPIRED" },
      "POST /numbers/num_8f2k/cancel": { number: { status: "refunded" }, refundAmount: 1.5 },
      "GET /numbers": { numbers: [rental, { id: "x" }], total: 2, page: 1, limit: 20 },
    });
    await expect(adapter.rentals.getRental("num_8f2k")).resolves.toMatchObject({ state: "EXPIRED" });
    await expect(adapter.rentals.cancelRental("num_8f2k")).resolves.toEqual({ state: "REFUNDED", refundAmount: "1.5" });
    expect(calls[1]!.body).toBeNull();
    const page = await adapter.rentals.listRentals(1, 20);
    expect(page.items).toHaveLength(1);
  });
});

describe("1001SMS adapter: account and errors", () => {
  it("reads the balance as a decimal string", async () => {
    const { adapter } = adapterWith({ "GET /informative/balance": { balance: 152.37, username: "shop" } });
    await expect(adapter.account.getBalance()).resolves.toEqual({ balance: "152.37" });
  });

  it("treats a malformed purchase response as uncertain (the supplier may have charged)", async () => {
    const { adapter } = adapterWith({ "POST /esims/order": { id: "eord_1" } });
    await expect(adapter.esim.orderEsim({ packageCode: "ES_1_7", quantity: 1 })).rejects.toMatchObject({ kind: "UNCERTAIN" });
  });

  it("treats a malformed read response as invalid, not uncertain", async () => {
    const { adapter } = adapterWith({ "GET /informative/balance": { balance: "lots" } });
    const err = await adapter.account.getBalance().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SupplierError);
    expect(err).toMatchObject({ kind: "INVALID_RESPONSE" });
  });
});
