import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaystackGateway, parsePaystackWebhook, verifyPaystackSignature } from "./paystack";
import { PaymentGatewayError, PaymentWebhookError } from "./types";

const SECRET = "sk_test_unit";

type Reply = { status: number; body: unknown } | "network-error";

function gatewayWith(...replies: Reply[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const reply = replies.shift();
    if (!reply) throw new Error("unexpected request");
    if (reply === "network-error") throw new TypeError("fetch failed");
    return new Response(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { gateway: createPaystackGateway({ secretKey: SECRET, baseUrl: "https://api.paystack.test/", fetchImpl }), calls };
}

async function gatewayErrorOf(p: Promise<unknown>): Promise<PaymentGatewayError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentGatewayError);
    return e as PaymentGatewayError;
  }
  throw new Error("expected rejection");
}

const sign = (body: string) => createHmac("sha512", SECRET).update(body).digest("hex");

const verifyData = {
  id: 4099260516,
  status: "success",
  reference: "PAY-ABC123",
  amount: 125000,
  currency: "ghs",
  channel: "card",
  fees: 2125,
  paid_at: "2026-10-24T10:00:00.000Z",
  gateway_response: "Successful",
};

describe("Paystack gateway: initialize", () => {
  it("posts minor units as a string with the bearer key and returns the hosted checkout URL", async () => {
    const { gateway, calls } = gatewayWith({ status: 200, body: { status: true, data: { authorization_url: "https://checkout.paystack.com/x1", reference: "PAY-1" } } });
    const result = await gateway.initialize({
      reference: "PAY-1",
      amountMinor: BigInt(125000),
      currency: "GHS",
      email: "a@example.test",
      callbackUrl: "https://shop.test/checkout/return?reference=PAY-1",
      metadata: { orderId: "o1" },
    });
    expect(result).toEqual({ authorizationUrl: "https://checkout.paystack.com/x1" });
    expect(calls[0]!.url).toBe("https://api.paystack.test/transaction/initialize");
    expect(calls[0]!.init.method).toBe("POST");
    expect(new Headers(calls[0]!.init.headers).get("Authorization")).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ amount: "125000", currency: "GHS", reference: "PAY-1", callback_url: expect.stringContaining("/checkout/return") });
  });

  it("rejects a response whose envelope status is false", async () => {
    const { gateway } = gatewayWith({ status: 200, body: { status: false, message: "Invalid key", data: null } });
    const err = await gatewayErrorOf(gateway.initialize({ reference: "r", amountMinor: BigInt(1), currency: "GHS", email: "a@b.test", callbackUrl: "https://x.test", metadata: {} }));
    expect(err.opts).toMatchObject({ retryable: false, uncertain: false });
  });
});

describe("Paystack gateway: verify", () => {
  it("maps a successful charge to minor units, upper-case currency and fee", async () => {
    const { gateway, calls } = gatewayWith({ status: 200, body: { status: true, data: verifyData } });
    const charge = await gateway.verify("PAY-ABC123");
    expect(calls[0]!.url).toBe("https://api.paystack.test/transaction/verify/PAY-ABC123");
    expect(charge).toEqual({
      reference: "PAY-ABC123",
      status: "SUCCESS",
      amountMinor: BigInt(125000),
      currency: "GHS",
      gatewayTransactionId: "4099260516",
      channel: "card",
      feeMinor: BigInt(2125),
      paidAt: new Date("2026-10-24T10:00:00.000Z"),
      gatewayMessage: "Successful",
    });
  });

  it.each([
    ["failed", "FAILED"],
    ["abandoned", "ABANDONED"],
    ["reversed", "REVERSED"],
    ["ongoing", "PENDING"],
    ["pending", "PENDING"],
    ["queued", "PENDING"],
  ])("treats gateway status %s as %s (never as success)", async (status, expected) => {
    const { gateway } = gatewayWith({ status: 200, body: { status: true, data: { ...verifyData, status, fees: null, paid_at: null } } });
    const charge = await gateway.verify("PAY-ABC123");
    expect(charge.status).toBe(expected);
    expect(charge.feeMinor).toBeNull();
    expect(charge.paidAt).toBeNull();
  });

  it("URL-encodes the reference so it cannot alter the request path", async () => {
    const { gateway, calls } = gatewayWith({ status: 200, body: { status: true, data: verifyData } });
    await gateway.verify("../refund?x=1");
    expect(calls[0]!.url).toBe("https://api.paystack.test/transaction/verify/..%2Frefund%3Fx%3D1");
  });

  it("rejects a malformed verify payload instead of guessing", async () => {
    const { gateway } = gatewayWith({ status: 200, body: { status: true, data: { reference: "PAY-ABC123", status: "success" } } });
    const err = await gatewayErrorOf(gateway.verify("PAY-ABC123"));
    expect(err.message).toBe("Unexpected payment gateway response");
  });

  it("marks 5xx and 429 as retryable but read failures as never uncertain", async () => {
    const server = await gatewayErrorOf(gatewayWith({ status: 502, body: { message: "Bad gateway" } }).gateway.verify("r"));
    expect(server.opts).toMatchObject({ retryable: true, uncertain: false, httpStatus: 502 });
    const limited = await gatewayErrorOf(gatewayWith({ status: 429, body: {} }).gateway.verify("r"));
    expect(limited.opts.retryable).toBe(true);
    const notFound = await gatewayErrorOf(gatewayWith({ status: 404, body: { message: "Transaction reference not found" } }).gateway.verify("r"));
    expect(notFound.message).toBe("Transaction reference not found");
    expect(notFound.opts).toMatchObject({ retryable: false, httpStatus: 404 });
  });

  it("surfaces a network failure as retryable", async () => {
    const err = await gatewayErrorOf(gatewayWith("network-error").gateway.verify("r"));
    expect(err.opts).toMatchObject({ retryable: true, uncertain: false });
  });
});

describe("Paystack gateway: refunds", () => {
  it("submits a refund with the transaction reference and maps the response", async () => {
    const { gateway, calls } = gatewayWith({ status: 200, body: { status: true, data: { id: 3018284, status: "pending", amount: 5000 } } });
    const refund = await gateway.refund({ reference: "PAY-1", gatewayTransactionId: "99", amountMinor: BigInt(5000), currency: "GHS", reason: "x".repeat(300) });
    expect(refund).toEqual({ gatewayRefundId: "3018284", status: "PENDING", amountMinor: BigInt(5000) });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ transaction: "PAY-1", amount: "5000", currency: "GHS" });
    expect(body.merchant_note).toHaveLength(200);
  });

  it("treats a refund submission that fails mid-flight as uncertain (it may have been accepted)", async () => {
    const network = await gatewayErrorOf(gatewayWith("network-error").gateway.refund({ reference: "r", gatewayTransactionId: null, amountMinor: BigInt(1), currency: "GHS", reason: "r" }));
    expect(network.opts).toMatchObject({ retryable: true, uncertain: true });
    const server = await gatewayErrorOf(gatewayWith({ status: 500, body: {} }).gateway.refund({ reference: "r", gatewayTransactionId: null, amountMinor: BigInt(1), currency: "GHS", reason: "r" }));
    expect(server.opts).toMatchObject({ retryable: true, uncertain: true });
    const rejected = await gatewayErrorOf(gatewayWith({ status: 400, body: { message: "Refund exceeds amount" } }).gateway.refund({ reference: "r", gatewayTransactionId: null, amountMinor: BigInt(1), currency: "GHS", reason: "r" }));
    expect(rejected.opts).toMatchObject({ retryable: false, uncertain: false });
  });

  it.each([
    ["processed", "PROCESSED"],
    ["failed", "FAILED"],
    ["processing", "PENDING"],
    ["needs-attention", "PENDING"],
  ])("maps refund status %s to %s", async (status, expected) => {
    const { gateway } = gatewayWith({ status: 200, body: { status: true, data: { id: "7", status, amount: null } } });
    await expect(gateway.getRefund("7")).resolves.toEqual({ gatewayRefundId: "7", status: expected, amountMinor: null });
  });

  it("lists refunds for a transaction", async () => {
    const { gateway, calls } = gatewayWith({ status: 200, body: { status: true, data: [{ id: 1, status: "processed", amount: 100 }, { id: 2, status: "pending", amount: "50" }] } });
    const list = await gateway.listRefunds("PAY 1");
    expect(calls[0]!.url).toBe("https://api.paystack.test/refund?transaction=PAY%201");
    expect(list.map((r) => [r.gatewayRefundId, r.status, r.amountMinor])).toEqual([
      ["1", "PROCESSED", BigInt(100)],
      ["2", "PENDING", BigInt(50)],
    ]);
  });
});

describe("Paystack webhooks", () => {
  const charge = JSON.stringify({ event: "charge.success", data: { id: 42, reference: "PAY-ABC123", amount: 125000 } });

  it("accepts a correctly signed body (signature case-insensitive)", () => {
    expect(verifyPaystackSignature(charge, sign(charge), SECRET)).toBe(true);
    expect(verifyPaystackSignature(charge, ` ${sign(charge).toUpperCase()} `, SECRET)).toBe(true);
  });

  it("rejects missing, forged, wrong-secret and tampered signatures", () => {
    expect(verifyPaystackSignature(charge, null, SECRET)).toBe(false);
    expect(verifyPaystackSignature(charge, "deadbeef", SECRET)).toBe(false);
    expect(verifyPaystackSignature(charge, createHmac("sha512", "other").update(charge).digest("hex"), SECRET)).toBe(false);
    expect(verifyPaystackSignature(charge.replace("125000", "1"), sign(charge), SECRET)).toBe(false);
  });

  it("verifyWebhook throws bad_signature before parsing anything", () => {
    const { gateway } = gatewayWith();
    expect(() => gateway.verifyWebhook(charge, new Headers({ "x-paystack-signature": "00" }))).toThrow(PaymentWebhookError);
    expect(gateway.verifyWebhook(charge, new Headers({ "x-paystack-signature": sign(charge) }))).toEqual({
      kind: "charge",
      eventId: "charge.success:42",
      type: "charge.success",
      reference: "PAY-ABC123",
    });
  });

  it("parses refund events from either reference field", () => {
    const flat = parsePaystackWebhook(JSON.stringify({ event: "refund.processed", data: { id: 9, status: "processed", transaction_reference: "PAY-1" } }));
    expect(flat).toEqual({ kind: "refund", eventId: "refund.processed:9", type: "refund.processed", gatewayRefundId: "9", transactionReference: "PAY-1", status: "PROCESSED" });
    const nested = parsePaystackWebhook(JSON.stringify({ event: "refund.failed", data: { refund_reference: "RF-2", transaction: { reference: "PAY-2" } } }));
    expect(nested).toMatchObject({ kind: "refund", gatewayRefundId: "RF-2", transactionReference: "PAY-2", status: "FAILED" });
  });

  it("derives a stable event id so retries de-duplicate", () => {
    const body = JSON.stringify({ event: "transfer.success", data: {} });
    const a = parsePaystackWebhook(body);
    const b = parsePaystackWebhook(body);
    expect(a.kind).toBe("ignored");
    expect(a.eventId).toBe(b.eventId);
    expect(a.eventId).toMatch(/^transfer\.success:[0-9a-f]{64}$/);
  });

  it.each([
    ["not json", "{"],
    ["no event", JSON.stringify({ data: {} })],
    ["charge without reference", JSON.stringify({ event: "charge.success", data: { id: 1 } })],
  ])("rejects an invalid payload (%s)", (_label, body) => {
    expect(() => parsePaystackWebhook(body)).toThrow(expect.objectContaining({ reason: "invalid_payload" }));
  });
});
