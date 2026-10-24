import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptField, encryptField, humanReference, safeEqualHex } from "./crypto";

describe("field encryption", () => {
  const key = randomBytes(32);

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptField("LPA:1$smdp.example$SECRET", key);
    const b = encryptField("LPA:1$smdp.example$SECRET", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("SECRET");
    expect(decryptField(a, key)).toBe("LPA:1$smdp.example$SECRET");
  });

  it("detects tampering and wrong keys", () => {
    const payload = encryptField("482910", key);
    const parts = payload.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptField(parts.join("."), key)).toThrow();
    expect(() => decryptField(payload, randomBytes(32))).toThrow();
  });
});

describe("helpers", () => {
  it("compares hex digests in constant time and rejects malformed input", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
  });

  it("generates unambiguous human references", () => {
    expect(humanReference("ORD")).toMatch(/^ORD-[2-9A-HJ-NP-Z]{8}$/);
  });
});
