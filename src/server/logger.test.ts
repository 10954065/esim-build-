import { describe, expect, it } from "vitest";
import { redact } from "./logger";

describe("log redaction", () => {
  it("removes OTPs, SMS text, activation codes, phone numbers and secrets at any depth", () => {
    const out = redact({
      orderId: "o1",
      phoneNumber: "+15550100",
      message: { code: "482910", text: "Your code is 482910" },
      profile: { activationCode: "LPA:1$x$y", qrCodeUrl: "https://qr" },
      headers: { authorization: "Bearer sk_live" },
      list: [{ apiKey: "k" }],
    }) as Record<string, unknown>;
    const json = JSON.stringify(out);
    for (const secret of ["+15550100", "482910", "LPA:1", "https://qr", "sk_live"]) expect(json).not.toContain(secret);
    expect(out.orderId).toBe("o1");
  });

  it("keeps non-sensitive fields and nulls", () => {
    expect(redact({ status: "PAID", code: null, durationMs: 12 })).toEqual({ status: "PAID", code: null, durationMs: 12 });
  });
});
