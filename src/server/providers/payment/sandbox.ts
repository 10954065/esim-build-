import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { signPayload, verifySignedPayload } from "@/server/providers/supplier/signature";
import { PaymentWebhookError, type GatewayRefund, type PaymentGateway, type PaymentWebhookEvent } from "./types";

/**
 * SANDBOX PAYMENT GATEWAY: simulated payments for development and automated tests.
 * - Keeps its own charge/refund records (SandboxGatewayCharge/Refund) so verification and
 *   refunds follow the same server-side path as a real gateway.
 * - Webhooks are signed (HMAC-SHA256 over `t.rawBody`) with SANDBOX_SIGNING_SECRET and are
 *   processed by the same handler as real gateway webhooks.
 * - Env validation forbids this gateway when APP_ENV=production and requires the sandbox
 *   supplier alongside it, so simulated payments can never buy real products.
 */

export const SANDBOX_PAYMENT_SIGNATURE_HEADER = "x-sandbox-payment-signature";

const webhookSchema = z.object({
  id: z.string(),
  event: z.string(),
  data: z.object({ reference: z.string().optional(), refundId: z.string().optional(), status: z.string().optional() }),
});

export function buildSandboxPaymentWebhook(event: string, data: Record<string, string>, secret: string): { rawBody: string; headers: Headers } {
  const rawBody = JSON.stringify({ id: `sbxevt_${randomBytes(8).toString("hex")}`, event, data });
  const headers = new Headers({
    "content-type": "application/json",
    [SANDBOX_PAYMENT_SIGNATURE_HEADER]: signPayload(rawBody, secret, Math.floor(Date.now() / 1000)),
  });
  return { rawBody, headers };
}

export function createSandboxGateway(config: { signingSecret: string | undefined; appUrl: string }): PaymentGateway {
  const toRefund = (r: { id: string; status: string; amountMinor: bigint }): GatewayRefund => ({
    gatewayRefundId: r.id,
    status: r.status === "PROCESSED" ? "PROCESSED" : r.status === "FAILED" ? "FAILED" : "PENDING",
    amountMinor: r.amountMinor,
  });

  return {
    code: "SANDBOX",
    isSandbox: true,
    async initialize(input) {
      await db.sandboxGatewayCharge.upsert({
        where: { reference: input.reference },
        update: {},
        create: {
          reference: input.reference,
          amountMinor: input.amountMinor,
          currency: input.currency,
          status: "PENDING",
          gatewayTransactionId: `sbx_txn_${randomBytes(8).toString("hex")}`,
        },
      });
      return { authorizationUrl: `${config.appUrl.replace(/\/$/, "")}/checkout/sandbox/${encodeURIComponent(input.reference)}` };
    },
    async verify(reference) {
      const charge = await db.sandboxGatewayCharge.findUnique({ where: { reference } });
      if (!charge) {
        return { reference, status: "ABANDONED", amountMinor: BigInt(0), currency: "", gatewayTransactionId: null, channel: null, feeMinor: null, paidAt: null, gatewayMessage: "Unknown reference" };
      }
      return {
        reference,
        status: charge.status === "SUCCESS" ? "SUCCESS" : charge.status === "FAILED" ? "FAILED" : "PENDING",
        amountMinor: charge.amountMinor,
        currency: charge.currency,
        gatewayTransactionId: charge.gatewayTransactionId,
        channel: "sandbox",
        feeMinor: BigInt(0),
        paidAt: charge.status === "SUCCESS" ? charge.updatedAt : null,
        gatewayMessage: charge.status === "FAILED" ? "Simulated decline" : null,
      };
    },
    async refund(input) {
      const charge = await db.sandboxGatewayCharge.findUnique({ where: { reference: input.reference } });
      if (!charge || charge.status !== "SUCCESS") throw new PaymentWebhookError("invalid_payload");
      const r = await db.sandboxGatewayRefund.create({
        data: { id: `sbx_rf_${randomBytes(8).toString("hex")}`, chargeReference: input.reference, amountMinor: input.amountMinor, currency: input.currency, status: "PENDING" },
      });
      return toRefund(r);
    },
    async getRefund(id) {
      const r = await db.sandboxGatewayRefund.findUniqueOrThrow({ where: { id } });
      return toRefund(r);
    },
    async listRefunds(reference) {
      const rows = await db.sandboxGatewayRefund.findMany({ where: { chargeReference: reference } });
      return rows.map(toRefund);
    },
    verifyWebhook(rawBody, headers): PaymentWebhookEvent {
      try {
        verifySignedPayload(rawBody, headers.get(SANDBOX_PAYMENT_SIGNATURE_HEADER), config.signingSecret);
      } catch (err) {
        const reason = (err as { reason?: string }).reason;
        throw new PaymentWebhookError(reason === "stale_timestamp" ? "stale_timestamp" : reason === "missing_signature" ? "missing_signature" : "bad_signature");
      }
      const parsed = webhookSchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) throw new PaymentWebhookError("invalid_payload");
      const { id, event, data } = parsed.data;
      if (event === "charge.success" && data.reference) return { kind: "charge", eventId: id, type: event, reference: data.reference };
      if (event.startsWith("refund.") && data.refundId) {
        const status = event === "refund.processed" ? "PROCESSED" : event === "refund.failed" ? "FAILED" : "PENDING";
        return { kind: "refund", eventId: id, type: event, gatewayRefundId: data.refundId, transactionReference: data.reference ?? null, status };
      }
      return { kind: "ignored", eventId: id, type: event };
    },
  };
}
