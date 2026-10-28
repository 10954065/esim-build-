import { Lock } from "lucide-react";
import Link from "next/link";
import { HomeLink } from "@/components/site/home-link";
import { Logo } from "@/components/site/logo";
import { StatusBanner } from "@/components/site/status-banner";
import { getStorefrontStatus } from "@/server/storefront";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const status = await getStorefrontStatus();
  return (
    <>
      <StatusBanner status={status} />
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-4 text-sm">
            <HomeLink />
            <Link href="/help" className="hidden font-medium text-muted-foreground hover:text-primary sm:inline">
              Need help?
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-success-soft px-3 py-1 text-xs font-semibold text-success">
              <Lock className="size-3.5" aria-hidden /> Secure checkout
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
        {children}
      </main>
    </>
  );
}
