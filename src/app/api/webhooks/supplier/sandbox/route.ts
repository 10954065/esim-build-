import { NextResponse } from "next/server";
import { getSupplierAdapter } from "@/server/providers/supplier";
import { isSandboxEnabled } from "@/server/sandbox/ops";
import { handleSupplierWebhook } from "@/server/webhooks/handlers";

/** Sandbox supplier webhook (signed with SANDBOX_SIGNING_SECRET). 404 unless sandbox mode is active. */
export async function POST(request: Request) {
  if (!isSandboxEnabled()) return new NextResponse(null, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 100_000) return new NextResponse(null, { status: 413 });
  const outcome = await handleSupplierWebhook(getSupplierAdapter(), "SUPPLIER_SANDBOX", rawBody, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
