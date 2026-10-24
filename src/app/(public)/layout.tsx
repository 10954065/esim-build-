import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { StatusBanner } from "@/components/site/status-banner";
import { getHeaderUser } from "@/server/auth/header-user";
import { getStorefrontStatus } from "@/server/storefront";

// Public pages read live catalogue data and settings from the database.
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, user] = await Promise.all([getStorefrontStatus(), getHeaderUser()]);
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <StatusBanner status={status} />
      <SiteHeader user={user} currency={status.currency} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
