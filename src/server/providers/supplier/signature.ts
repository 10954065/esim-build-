import { hmacHex, safeEqualHex } from "@/server/crypto";
import { SupplierWebhookError } from "./errors";

/**
 * 1001SMS webhook signature scheme (documented):
 *   X-1001SMS-Signature: t=<unix seconds>,v1=<hex>
 *   v1 = HMAC-SHA256(secret, `${t}.${rawBody}`)
 * Compare in constant time; reject timestamps older than 5 minutes.
 * The sandbox supplier uses the same scheme with its own secret.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export function parseSignatureHeader(header: string): { t: number; v1: string[] } | null {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (k === "t" && /^\d+$/.test(value)) t = Number(value);
    if (k === "v1" && value) v1.push(value);
  }
  if (t === null || v1.length === 0) return null;
  return { t, v1 };
}

export function signPayload(rawBody: string, secret: string, timestampSeconds: number): string {
  const sig = hmacHex("sha256", secret, `${timestampSeconds}.${rawBody}`);
  return `t=${timestampSeconds},v1=${sig}`;
}

export function verifySignedPayload(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  now: Date = new Date(),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): void {
  if (!secret) throw new SupplierWebhookError("not_configured", "Webhook secret is not configured");
  if (!header) throw new SupplierWebhookError("missing_signature");
  const parsed = parseSignatureHeader(header);
  if (!parsed) throw new SupplierWebhookError("bad_signature", "Malformed signature header");

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.t) > toleranceSeconds) {
    throw new SupplierWebhookError("stale_timestamp");
  }
  const expected = hmacHex("sha256", secret, `${parsed.t}.${rawBody}`);
  if (!parsed.v1.some((candidate) => safeEqualHex(candidate, expected))) {
    throw new SupplierWebhookError("bad_signature");
  }
}
