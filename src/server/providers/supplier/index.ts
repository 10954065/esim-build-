import "server-only";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { SupplierError } from "./errors";
import { createSandboxAdapter } from "./sandbox/adapter";
import { createSms1001Adapter } from "./sms1001/adapter";
import type { SupplierAdapter } from "./types";

/**
 * Resolves the configured supplier adapter. Exactly one supplier is active per
 * deployment (SUPPLIER_MODE). Secrets are read here, server-side only.
 */

let cached: SupplierAdapter | null | undefined;

export function getSupplierAdapter(): SupplierAdapter {
  if (cached === undefined) {
    const env = getEnv();
    if (env.SUPPLIER_MODE === "live") {
      cached = createSms1001Adapter({
        baseUrl: env.SMS1001_BASE_URL,
        apiKey: env.SMS1001_API_KEY!,
        timeoutMs: env.SUPPLIER_TIMEOUT_MS,
        webhookSecret: env.SMS1001_WEBHOOK_SECRET,
        priceCurrency: env.SUPPLIER_PRICE_CURRENCY,
      });
    } else if (env.SUPPLIER_MODE === "sandbox") {
      cached = createSandboxAdapter({
        signingSecret: env.SANDBOX_SIGNING_SECRET,
        priceCurrency: env.SUPPLIER_PRICE_CURRENCY,
      });
    } else {
      cached = null;
    }
  }
  if (!cached) throw new SupplierError("NOT_CONFIGURED", "No supplier is configured (SUPPLIER_MODE=disabled)");
  return cached;
}

export function isSupplierConfigured(): boolean {
  return getEnv().SUPPLIER_MODE !== "disabled";
}

/** Ensure the Supplier row for the active adapter exists and return its id. */
export async function ensureSupplierRecord(adapter: SupplierAdapter = getSupplierAdapter()): Promise<{ id: string; code: string }> {
  const row = await db.supplier.upsert({
    where: { code: adapter.code },
    update: { name: adapter.name, mode: adapter.mode, priceCurrency: adapter.priceCurrency },
    create: { code: adapter.code, name: adapter.name, mode: adapter.mode, priceCurrency: adapter.priceCurrency },
    select: { id: true, code: true },
  });
  return row;
}

/** Test hook: reset the cached adapter (env changes between tests). */
export function __resetSupplierAdapterForTests(adapter?: SupplierAdapter | null): void {
  cached = adapter === undefined ? undefined : adapter;
}

export type { SupplierAdapter } from "./types";
export { SupplierError, SupplierWebhookError, isSupplierError } from "./errors";
