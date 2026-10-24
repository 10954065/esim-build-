import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { getSupplierAdapter } from "@/server/providers/supplier";
import { handleSupplierWebhook } from "@/server/webhooks/handlers";

/**
 * 1001SMS webhook (X-1001SMS-Signature: t=<unix>,v1=HMAC-SHA256(`t.rawBody`), 5-minute
 * tolerance). Must answer within 10 seconds; failures return 5xx so 1001SMS retries.
 */
export async function POST(request: Request) {
  if (getEnv().SUPPLIER_MODE !== "live") return new NextResponse(null, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return new NextResponse(null, { status: 413 });
  const outcome = await handleSupplierWebhook(getSupplierAdapter(), "SUPPLIER_1001SMS", rawBody, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
