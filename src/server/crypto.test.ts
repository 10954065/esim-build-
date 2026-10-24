import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { decryptField, decryptOptional, encryptField, encryptOptional, humanReference, reencryptField, safeEqualHex } from "./crypto";

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

describe("key rotation", () => {
  const saved = { current: process.env.DATA_ENCRYPTION_KEY, previous: process.env.DATA_ENCRYPTION_KEYS_PREVIOUS };
  const oldKey = randomBytes(32);
  const newKey = randomBytes(32);
  const useKeys = (current: Buffer, previous: Buffer[] = []) => {
    process.env.DATA_ENCRYPTION_KEY = current.toString("base64");
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = previous.map((k) => k.toString("base64")).join(",");
  };

  afterEach(() => {
    process.env.DATA_ENCRYPTION_KEY = saved.current;
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = saved.previous ?? "";
  });

  it("keeps reading values written with a retired key while new values use the current key", () => {
    useKeys(oldKey);
    const stored = encryptField("LPA:1$smdp.example$OLD");
    useKeys(newKey, [randomBytes(32), oldKey]);
    expect(decryptField(stored)).toBe("LPA:1$smdp.example$OLD");
    const fresh = encryptField("482910");
    expect(decryptField(fresh, newKey)).toBe("482910");
    expect(() => decryptField(fresh, oldKey)).toThrow();
  });

  it("refuses values from a key that is not configured at all", () => {
    useKeys(oldKey);
    const stored = encryptField("secret");
    useKeys(newKey);
    expect(() => decryptField(stored)).toThrow();
  });

  it("re-encrypts retired-key values to the current key and leaves current ones alone", () => {
    useKeys(oldKey);
    const stored = encryptField("SMS body");
    useKeys(newKey, [oldKey]);
    const rotated = reencryptField(stored);
    expect(rotated).not.toBeNull();
    expect(decryptField(rotated!, newKey)).toBe("SMS body");
    expect(reencryptField(rotated!)).toBeNull();
  });

  it("rejects malformed key configuration", () => {
    useKeys(oldKey);
    const stored = encryptField("x");
    process.env.DATA_ENCRYPTION_KEY = newKey.toString("base64");
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = "too-short";
    expect(() => decryptField(stored)).toThrow("DATA_ENCRYPTION_KEYS_PREVIOUS must decode to 32 bytes");
  });

  it("passes empty optional values through", () => {
    expect(encryptOptional(null)).toBeNull();
    expect(decryptOptional("")).toBeNull();
    expect(decryptOptional(encryptOptional("kept"))).toBe("kept");
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
