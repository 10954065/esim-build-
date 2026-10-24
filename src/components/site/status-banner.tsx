import { FlaskConical, Info, PauseCircle } from "lucide-react";
import type { StorefrontStatus } from "@/server/storefront";

/** Site-wide banners: demo mode (always visible when on), purchases paused, announcements. */
export function StatusBanner({ status }: { status: StorefrontStatus }) {
  return (
    <>
      {status.demoMode && (
        <div role="status" className="border-b border-warning/30 bg-warning-soft text-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
            <FlaskConical className="size-4 shrink-0 text-warning" aria-hidden />
            <p>
              <strong className="font-semibold">Demo mode.</strong> Catalogue, payments and deliveries are simulated. No real eSIMs or
              phone numbers are issued and no money is charged.
            </p>
          </div>
        </div>
      )}
      {!status.purchasesEnabled && (
        <div role="status" className="border-b bg-muted text-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
            <PauseCircle className="size-4 shrink-0" aria-hidden />
            <p>New purchases are temporarily paused. Existing orders and your dashboard are unaffected.</p>
          </div>
        </div>
      )}
      {status.announcement && (
        <div className="border-b bg-brand-soft text-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
            <Info className="size-4 shrink-0 text-brand" aria-hidden />
            <p>{status.announcement}</p>
          </div>
        </div>
      )}
    </>
  );
}
