import { NextResponse } from "next/server";
import { getPaymentGateway } from "@/server/providers/payment";
import { isSandboxEnabled } from "@/server/sandbox/ops";
import { handlePaymentWebhook } from "@/server/webhooks/handlers";

/** Sandbox gateway webhook (signed with SANDBOX_SIGNING_SECRET). 404 unless sandbox mode is active. */
export async function POST(request: Request) {
  if (!isSandboxEnabled()) return new NextResponse(null, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 100_000) return new NextResponse(null, { status: 413 });
  const outcome = await handlePaymentWebhook(getPaymentGateway(), "SANDBOX_PAYMENT", rawBody, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
