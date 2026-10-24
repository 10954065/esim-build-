import "server-only";
import { getEnv } from "@/server/env";
import { getSetting } from "@/server/settings";

/** Non-secret storefront status for rendering banners and disabling purchases. */
export interface StorefrontStatus {
  demoMode: boolean;
  supplierConfigured: boolean;
  paymentsConfigured: boolean;
  purchasesEnabled: boolean;
  announcement: string;
  currency: string;
}

export async function getStorefrontStatus(): Promise<StorefrontStatus> {
  const env = getEnv();
  const [purchasesEnabled, announcement] = await Promise.all([
    getSetting("store.purchasesEnabled"),
    getSetting("store.announcement"),
  ]);
  return {
    demoMode: env.SUPPLIER_MODE === "sandbox" || env.PAYMENT_PROVIDER === "sandbox",
    supplierConfigured: env.SUPPLIER_MODE !== "disabled",
    paymentsConfigured: env.PAYMENT_PROVIDER !== "disabled",
    purchasesEnabled,
    announcement,
    currency: env.PAYMENT_CURRENCY,
  };
}
