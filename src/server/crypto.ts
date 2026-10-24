import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM field encryption for sensitive data at rest
 * (eSIM activation codes, QR URLs, SMS bodies and codes).
 * Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 *
 * Key rotation: new values always use DATA_ENCRYPTION_KEY. Retired keys listed in
 * DATA_ENCRYPTION_KEYS_PREVIOUS still decrypt (GCM authentication rejects a wrong key), so a
 * rotation needs no downtime; `pnpm data:reencrypt` then moves stored values to the new key.
 */

const VERSION = "v1";

function parseKey(raw: string, name: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new Error(`${name} must decode to 32 bytes`);
  return key;
}

function defaultKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY is not configured");
  return parseKey(raw, "DATA_ENCRYPTION_KEY");
}

function previousKeys(): Buffer[] {
  const raw = process.env.DATA_ENCRYPTION_KEYS_PREVIOUS ?? "";
  return raw
    .split(",")
    .filter((k) => k.trim())
    .map((k) => parseKey(k, "DATA_ENCRYPTION_KEYS_PREVIOUS"));
}

export function encryptField(plaintext: string, key: Buffer = defaultKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

function decryptWith(payload: string, key: Buffer): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("Unsupported encrypted payload format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Decrypt with the given key, or with the current key and then any retired keys. */
export function decryptField(payload: string, key?: Buffer): string {
  if (key) return decryptWith(payload, key);
  try {
    return decryptWith(payload, defaultKey());
  } catch (err) {
    for (const retired of previousKeys()) {
      try {
        return decryptWith(payload, retired);
      } catch {
        // Not this retired key either; try the next one.
      }
    }
    throw err;
  }
}

/** Re-encrypt a stored value with the current key; null when it already uses the current key. */
export function reencryptField(payload: string): string | null {
  const current = defaultKey();
  try {
    decryptWith(payload, current);
    return null;
  } catch {
    return encryptField(decryptField(payload), current);
  }
}

export function encryptOptional(value: string | null | undefined): string | null {
  return value ? encryptField(value) : null;
}

export function decryptOptional(value: string | null | undefined): string | null {
  return value ? decryptField(value) : null;
}

export function hmacHex(algorithm: "sha256" | "sha512", secret: string, data: string | Buffer): string {
  return createHmac(algorithm, secret).update(data).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** Short human-friendly reference such as ORD-7KX3Q9PM (no ambiguous characters). */
export function humanReference(prefix: string, length = 8): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${prefix}-${out}`;
}
