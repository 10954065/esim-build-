import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { getPaymentGateway } from "@/server/providers/payment";
import { handlePaymentWebhook } from "@/server/webhooks/handlers";

/**
 * Paystack webhook. Signature (x-paystack-signature, HMAC-SHA512 of the raw body) is
 * verified before anything else; events are deduplicated; charges are re-verified with the
 * Paystack API before an order is marked paid.
 */
export async function POST(request: Request) {
  if (getEnv().PAYMENT_PROVIDER !== "paystack") return new NextResponse(null, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return new NextResponse(null, { status: 413 });
  const outcome = await handlePaymentWebhook(getPaymentGateway(), "PAYSTACK", rawBody, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
