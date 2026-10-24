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
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </>
  );
}
