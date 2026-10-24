import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SupplierWebhookError } from "./errors";
import { parseSignatureHeader, signPayload, verifySignedPayload } from "./signature";

const secret = "whsec_test_123";
const body = JSON.stringify({ id: "evt_1", event: "ping", data: {} });
const now = new Date("2026-10-22T12:00:00Z");
const t = Math.floor(now.getTime() / 1000);

describe("1001SMS webhook signature", () => {
  it("matches the documented algorithm: HMAC-SHA256 over `${t}.${rawBody}`", () => {
    const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(signPayload(body, secret, t)).toBe(`t=${t},v1=${expected}`);
  });

  it("accepts a valid signature", () => {
    expect(() => verifySignedPayload(body, signPayload(body, secret, t), secret, now)).not.toThrow();
  });

  it("rejects a tampered body", () => {
    const header = signPayload(body, secret, t);
    expect(() => verifySignedPayload(body.replace("ping", "pong"), header, secret, now)).toThrow(SupplierWebhookError);
  });

  it("rejects a signature made with another secret", () => {
    expect(() => verifySignedPayload(body, signPayload(body, "other", t), secret, now)).toThrow(/bad_signature/);
  });

  it("rejects timestamps older than five minutes (replay protection)", () => {
    expect(() => verifySignedPayload(body, signPayload(body, secret, t - 301), secret, now)).toThrow(/stale_timestamp/);
  });

  it("rejects missing headers and unconfigured secrets", () => {
    expect(() => verifySignedPayload(body, null, secret, now)).toThrow(/missing_signature/);
    expect(() => verifySignedPayload(body, signPayload(body, secret, t), undefined, now)).toThrow(
      expect.objectContaining({ reason: "not_configured" }),
    );
  });

  it("parses headers with multiple v1 values (secret rotation)", () => {
    expect(parseSignatureHeader("t=1,v1=aa,v1=bb")).toEqual({ t: 1, v1: ["aa", "bb"] });
    expect(parseSignatureHeader("garbage")).toBeNull();
  });
});
