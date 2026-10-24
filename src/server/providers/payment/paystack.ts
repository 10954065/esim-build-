import { createHash } from "node:crypto";
import { z } from "zod";
import { hmacHex, safeEqualHex } from "@/server/crypto";
import { logger } from "@/server/logger";
import {
  PaymentGatewayError,
  PaymentWebhookError,
  type GatewayChargeStatus,
  type GatewayRefund,
  type GatewayRefundStatus,
  type PaymentGateway,
  type PaymentWebhookEvent,
} from "./types";

/**
 * Paystack adapter (https://paystack.com/docs).
 * - initialize: POST /transaction/initialize → hosted checkout (authorization_url)
 * - verify:     GET  /transaction/verify/:reference (server-side source of truth)
 * - refund:     POST /refund, GET /refund/:id, GET /refund?transaction=
 * - webhooks:   x-paystack-signature = HMAC-SHA512(raw body, secret key)
 *
 * STATUS: implemented from Paystack's API reference; not yet exercised against a live or
 * test account (see docs/INTEGRATION_STATUS.md). Merchant eligibility for this business
 * category must be confirmed with Paystack before going live.
 */

const log = logger.child({ component: "paystack" });

const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ status: z.boolean(), message: z.string().optional(), data });

const verifySchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  reference: z.string(),
  amount: z.union([z.number(), z.string()]).transform((v) => BigInt(v)),
  currency: z.string(),
  channel: z.string().nullish(),
  fees: z.union([z.number(), z.string()]).nullish().transform((v) => (v === null || v === undefined ? null : BigInt(v))),
  paid_at: z.string().nullish(),
  gateway_response: z.string().nullish(),
});

const refundSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  amount: z.union([z.number(), z.string()]).nullish().transform((v) => (v === null || v === undefined ? null : BigInt(v))),
});

function mapChargeStatus(s: string): GatewayChargeStatus {
  switch (s.toLowerCase()) {
    case "success":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "abandoned":
      return "ABANDONED";
    case "reversed":
      return "REVERSED";
    default:
      return "PENDING"; // ongoing, pending, processing, queued
  }
}

function mapRefundStatus(s: string): GatewayRefundStatus {
  const v = s.toLowerCase();
  if (v === "processed") return "PROCESSED";
  if (v === "failed") return "FAILED";
  return "PENDING"; // pending, processing, needs-attention
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  return safeEqualHex(signature.trim().toLowerCase(), hmacHex("sha512", secret, rawBody));
}

export function parsePaystackWebhook(rawBody: string): PaymentWebhookEvent {
  let body: { event?: unknown; data?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new PaymentWebhookError("invalid_payload");
  }
  const type = typeof body.event === "string" ? body.event : "";
  const data = body.data ?? {};
  if (!type) throw new PaymentWebhookError("invalid_payload");
  // Paystack does not send an event id; derive a stable one for deduplication.
  const natural = data.id ?? data.reference ?? createHash("sha256").update(rawBody).digest("hex");
  const eventId = `${type}:${String(natural)}`;

  if (type === "charge.success") {
    if (typeof data.reference !== "string") throw new PaymentWebhookError("invalid_payload");
    return { kind: "charge", eventId, type, reference: data.reference };
  }
  if (type.startsWith("refund.")) {
    const transaction = data.transaction as { reference?: unknown } | undefined;
    const transactionReference =
      typeof data.transaction_reference === "string" ? data.transaction_reference : typeof transaction?.reference === "string" ? transaction.reference : null;
    const refundId = data.id ?? data.refund_reference;
    const status = mapRefundStatus(typeof data.status === "string" ? data.status : type.replace("refund.", ""));
    return { kind: "refund", eventId, type, gatewayRefundId: refundId !== undefined ? String(refundId) : null, transactionReference, status };
  }
  return { kind: "ignored", eventId, type };
}

export function createPaystackGateway(config: { secretKey: string; baseUrl: string; fetchImpl?: typeof fetch }): PaymentGateway {
  const doFetch = config.fetchImpl ?? fetch;

  async function call<S extends z.ZodTypeAny>(method: "GET" | "POST", path: string, schema: S, body?: unknown, mutating = false): Promise<z.output<S>> {
    let res: Response;
    try {
      res = await doFetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
    } catch {
      log.warn("paystack request failed before response", { path, method });
      throw new PaymentGatewayError("Payment gateway unreachable", { retryable: true, uncertain: mutating });
    }
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = (json as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
      log.warn("paystack request rejected", { path, status: res.status });
      throw new PaymentGatewayError(message, { retryable: res.status >= 500 || res.status === 429, uncertain: mutating && res.status >= 500, httpStatus: res.status });
    }
    const parsed = envelope(schema).safeParse(json);
    if (!parsed.success || !parsed.data.status) {
      throw new PaymentGatewayError("Unexpected payment gateway response", { retryable: false, uncertain: mutating, httpStatus: res.status });
    }
    return (parsed.data as unknown as { data: z.output<S> }).data;
  }

  const toRefund = (r: z.output<typeof refundSchema>): GatewayRefund => ({ gatewayRefundId: r.id, status: mapRefundStatus(r.status), amountMinor: r.amount });

  return {
    code: "PAYSTACK",
    isSandbox: false,
    async initialize(input) {
      const data = await call(
        "POST",
        "/transaction/initialize",
        z.object({ authorization_url: z.url(), reference: z.string() }),
        {
          email: input.email,
          amount: input.amountMinor.toString(),
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: input.metadata,
        },
      );
      return { authorizationUrl: data.authorization_url };
    },
    async verify(reference) {
      const d = await call("GET", `/transaction/verify/${encodeURIComponent(reference)}`, verifySchema);
      return {
        reference: d.reference,
        status: mapChargeStatus(d.status),
        amountMinor: d.amount,
        currency: d.currency.toUpperCase(),
        gatewayTransactionId: d.id,
        channel: d.channel ?? null,
        feeMinor: d.fees,
        paidAt: d.paid_at ? new Date(d.paid_at) : null,
        gatewayMessage: d.gateway_response ?? null,
      };
    },
    async refund(input) {
      const d = await call("POST", "/refund", refundSchema, { transaction: input.reference, amount: input.amountMinor.toString(), currency: input.currency, merchant_note: input.reason.slice(0, 200) }, true);
      return toRefund(d);
    },
    async getRefund(id) {
      return toRefund(await call("GET", `/refund/${encodeURIComponent(id)}`, refundSchema));
    },
    async listRefunds(reference) {
      const list = await call("GET", `/refund?transaction=${encodeURIComponent(reference)}`, z.array(refundSchema));
      return list.map(toRefund);
    },
    verifyWebhook(rawBody, headers) {
      if (!verifyPaystackSignature(rawBody, headers.get("x-paystack-signature"), config.secretKey)) {
        throw new PaymentWebhookError("bad_signature");
      }
      return parsePaystackWebhook(rawBody);
    },
  };
}
