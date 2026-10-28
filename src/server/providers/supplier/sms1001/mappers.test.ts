import { describe, expect, it } from "vitest";
import { signPayload } from "../signature";
import { MAX_STOCK_COUNT, mapActivation, mapActivationState, mapDestinationKind, mapEsimOrder, mapOffer, mapPackage, mapUnknownTerms } from "./mappers";
import { activationOrderSchema, esimOrderSchema, operatorSchema, packageSchema } from "./schemas";
import { createSignedWebhookVerifier, parseSupplierWebhookBody } from "./webhook";

// Fixtures copied from the documented examples at https://www.1001sms.com/api-docs.

const docEsimOrder = {
  id: "eord_9x1",
  status: "ALLOCATED",
  packageCode: "ES_1_7",
  packageName: "Spain Unlimited · 7 days",
  unlimited: true,
  days: 7,
  locationCode: "ES",
  quantity: 1,
  price: 12.1,
  createdAt: "2026-09-22T10:00:00.000Z",
  ready: true,
  profiles: [
    {
      id: "prof_1",
      esimTranNo: "T2026092200001",
      iccid: "8943100000000000001",
      activationCode: "LPA:1$rsp-eu.example.com$ABCDEF123456",
      qrCodeUrl: "https://cdn.example.com/qr/T2026092200001.png",
      shortUrl: "https://esim.example.com/s/abc",
      apn: "internet",
      status: "GOT_RESOURCE",
      smdpStatus: "RELEASED",
      totalVolume: "1073741824",
      usedVolume: "0",
      activatedAt: null,
      expiresAt: null,
    },
  ],
  lifecycle: "ready",
};

describe("1001SMS mappers", () => {
  it("maps the documented eSIM order including LPA activation data", () => {
    const order = mapEsimOrder(esimOrderSchema.parse(docEsimOrder));
    expect(order.supplierOrderId).toBe("eord_9x1");
    expect(order.lifecycle).toBe("READY");
    expect(order.cost).toBe("12.1");
    expect(order.profiles[0]?.activationCode).toBe("LPA:1$rsp-eu.example.com$ABCDEF123456");
    expect(order.profiles[0]?.totalVolumeBytes).toBe(BigInt(1073741824));
  });

  it("maps packages as data-only (no phone number, SMS or voice)", () => {
    const pkg = mapPackage(
      packageSchema.parse({
        id: "clx_pkg",
        packageCode: "ES_1_7",
        name: "Spain 1GB/Day",
        locationCode: "ES",
        locationName: "Spain",
        volumeLabel: "1 GB/day",
        volumeBytes: "1073741824",
        durationDays: 1,
        speed: "5G",
        price: 1.9,
        unlimited: true,
        pricingUnit: "per_day",
        fupPolicy: "1 Mbps",
        fupKbps: 1000,
        ipExport: "ES",
      }),
    );
    expect(pkg.cost).toBe("1.9");
    expect(pkg.includesPhoneNumber).toBe(false);
    expect(pkg.includesSms).toBe(false);
    expect(pkg.pricingUnit).toBe("per_day");
  });

  it("maps the documented activation order", () => {
    const a = mapActivation(
      activationOrderSchema.parse({
        id: "ord_123",
        phoneNumber: "+14155552671",
        countryCode: "US",
        countryName: "United States",
        serviceId: "google",
        serviceName: "Google",
        operatorName: "virtual9",
        price: 0.5,
        status: "RENTED",
        provider: "EXTRA",
        providerId: "987654321",
        expiresAt: "2026-02-01T12:15:00.000Z",
        rentedAt: "2026-02-01T12:00:00.000Z",
      }),
    );
    expect(a.state).toBe("WAITING");
    expect(a.cost).toBe("0.5");
    expect(a.providerTier).toBe("EXTRA");
  });

  it("derives activation state from supplier status and messages", () => {
    expect(mapActivationState("RENTED", false)).toBe("WAITING");
    expect(mapActivationState("RENTED", true)).toBe("RECEIVED");
    expect(mapActivationState("REFUNDED", false)).toBe("REFUNDED");
    expect(mapActivationState("EXPIRED", false)).toBe("EXPIRED");
    expect(mapActivationState("BLOCKED", false)).toBe("BLOCKED");
  });

  it("maps destination kinds and drops malformed rental terms", () => {
    expect(mapDestinationKind("country")).toBe("COUNTRY");
    expect(mapDestinationKind("region")).toBe("REGION");
    expect(mapDestinationKind("global")).toBe("GLOBAL");
    expect(mapUnknownTerms([{ term: "7d", days: 7, hours: 168, price: 3 }, { nope: true }])).toEqual([
      { term: "7d", days: 7, hours: 168, cost: "3" },
    ]);
  });

  it("caps pooled stock counts that exceed a database integer", () => {
    const op = operatorSchema.parse({ operator: "any", price: 0.5, count: 8_412_962_267, provider: "STANDARD" });
    expect(mapOffer("al", "whatsapp", "WhatsApp", op).stock).toBe(MAX_STOCK_COUNT);
    expect(mapOffer("al", "whatsapp", "WhatsApp", { ...op, count: 42 }).stock).toBe(42);
  });

  it("rounds fractional deliverability percentages to whole numbers", () => {
    const op = operatorSchema.parse({ operator: "any", price: 0.5, count: 3, provider: "STANDARD", deliverability: 33.33 });
    expect(mapOffer("lt", "whatsapp", "WhatsApp", op).deliverability).toBe(33);
    expect(mapOffer("lt", "whatsapp", "WhatsApp", { ...op, deliverability: 38.5 }).deliverability).toBe(39);
    expect(mapOffer("lt", "whatsapp", "WhatsApp", { ...op, deliverability: null }).deliverability).toBeNull();
  });
});

describe("1001SMS webhook parsing", () => {
  const docSms = {
    id: "evt_3f9a1c2b7d8e4f50a1b2",
    event: "sms.received",
    createdAt: "2026-09-22T10:03:01.000Z",
    data: {
      product: "virtual_number",
      numberId: "num_8f2k",
      phoneNumber: "+447700900123",
      country: "GB",
      service: "full",
      serviceName: "All services",
      message: {
        id: "msg_1",
        sender: "WhatsApp",
        text: "Your WhatsApp code: 482-910",
        code: "482910",
        receivedAt: "2026-09-22T10:03:00.000Z",
      },
    },
  };

  it("parses the documented sms.received payload for a rental number", () => {
    const evt = parseSupplierWebhookBody(JSON.stringify(docSms));
    expect(evt.kind).toBe("sms.received");
    if (evt.kind !== "sms.received") return;
    expect(evt.product).toBe("rental");
    expect(evt.supplierRef).toBe("num_8f2k");
    expect(evt.message.code).toBe("482910");
  });

  it("parses activation SMS keyed by orderId", () => {
    const body = {
      ...docSms,
      data: { product: "activation", orderId: "ord_123", message: { id: "m", message: "code 1", receivedAt: "2026-09-22T10:03:00.000Z" } },
    };
    const evt = parseSupplierWebhookBody(JSON.stringify(body));
    expect(evt.kind === "sms.received" && evt.product === "activation" && evt.supplierRef === "ord_123").toBe(true);
  });

  it("parses esim.allocated and unknown events", () => {
    const evt = parseSupplierWebhookBody(JSON.stringify({ id: "evt_2", event: "esim.allocated", data: { order: docEsimOrder } }));
    expect(evt.kind).toBe("esim.update");
    expect(parseSupplierWebhookBody(JSON.stringify({ id: "evt_3", event: "something.new", data: {} })).kind).toBe("unsupported");
  });

  it("rejects malformed bodies", () => {
    expect(() => parseSupplierWebhookBody("not json")).toThrow();
    expect(() => parseSupplierWebhookBody(JSON.stringify({ event: "ping" }))).toThrow();
  });

  it("verifies signatures before parsing", () => {
    const verifier = createSignedWebhookVerifier("secret");
    const raw = JSON.stringify(docSms);
    const now = new Date();
    const headers = new Headers({ "x-1001sms-signature": signPayload(raw, "secret", Math.floor(now.getTime() / 1000)) });
    expect(verifier.verifyAndParse(raw, headers, now).kind).toBe("sms.received");
    expect(() => verifier.verifyAndParse(raw, new Headers(), now)).toThrow();
  });
});
