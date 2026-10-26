import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { getPaymentGateway } from "@/server/providers/payment";
import { buildSandboxPaymentWebhook } from "@/server/providers/payment/sandbox";
import { getSupplierAdapter } from "@/server/providers/supplier";
import { SANDBOX_SIGNATURE_HEADER } from "@/server/providers/supplier/sandbox/adapter";
import { signPayload } from "@/server/providers/supplier/signature";
import { handlePaymentWebhook, handleSupplierWebhook } from "@/server/webhooks/handlers";

/**
 * SANDBOX OPERATIONS: simulate the outside world (customer paying at the gateway, gateway
 * settling a refund, an SMS arriving) by producing correctly signed webhooks and feeding them
 * through the same handlers as real events. Every function refuses to run unless the sandbox
 * providers are active, and env validation forbids those in production.
 */

export class SandboxDisabledError extends Error {
  constructor() {
    super("Sandbox operations are disabled");
    this.name = "SandboxDisabledError";
  }
}

function secret(): string {
  const env = getEnv();
  if (env.PAYMENT_PROVIDER !== "sandbox" || env.SUPPLIER_MODE !== "sandbox" || env.APP_ENV === "production" || !env.SANDBOX_SIGNING_SECRET) {
    throw new SandboxDisabledError();
  }
  return env.SANDBOX_SIGNING_SECRET;
}

export function isSandboxEnabled(): boolean {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

/** The simulated customer completes (or fails) the sandbox checkout. */
export async function decideSandboxCharge(reference: string, outcome: "success" | "failure") {
  const key = secret();
  const charge = await db.sandboxGatewayCharge.findUnique({ where: { reference } });
  if (!charge) throw new Error("Unknown sandbox charge");
  if (charge.status === "PENDING") {
    await db.sandboxGatewayCharge.update({ where: { reference }, data: { status: outcome === "success" ? "SUCCESS" : "FAILED" } });
  }
  if (outcome === "success") {
    const { rawBody, headers } = buildSandboxPaymentWebhook("charge.success", { reference }, key);
    return handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, headers);
  }
  return null;
}

/** The simulated gateway settles a refund and notifies us. */
export async function processSandboxRefund(gatewayRefundId: string) {
  const key = secret();
  const refund = await db.sandboxGatewayRefund.findUnique({ where: { id: gatewayRefundId } });
  if (!refund) return null;
  if (refund.status === "PENDING") await db.sandboxGatewayRefund.update({ where: { id: refund.id }, data: { status: "PROCESSED" } });
  const { rawBody, headers } = buildSandboxPaymentWebhook("refund.processed", { refundId: refund.id, reference: refund.chargeReference }, key);
  return handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, headers);
}

/** Simulate an incoming SMS for a sandbox verification session or rental. */
export async function simulateSandboxSms(target: { kind: "activation" | "rental"; supplierRef: string }, text: string, code: string | null) {
  const key = secret();
  const adapter = getSupplierAdapter();
  const body = JSON.stringify({
    id: `evt_sbx_${randomBytes(8).toString("hex")}`,
    event: "sms.received",
    createdAt: new Date().toISOString(),
    data: {
      product: target.kind === "rental" ? "virtual_number" : "activation",
      ...(target.kind === "rental" ? { numberId: target.supplierRef } : { orderId: target.supplierRef }),
      message: { id: `msg_sbx_${randomBytes(6).toString("hex")}`, sender: "DemoService", text, code, receivedAt: new Date().toISOString() },
    },
  });
  const headers = new Headers({ [SANDBOX_SIGNATURE_HEADER]: signPayload(body, key, Math.floor(Date.now() / 1000)) });
  return handleSupplierWebhook(adapter, "SUPPLIER_SANDBOX", body, headers);
}
