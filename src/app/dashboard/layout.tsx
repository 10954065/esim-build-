import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav, SignOutButton } from "@/components/dashboard/dashboard-nav";
import { Logo } from "@/components/site/logo";
import { StatusBanner } from "@/components/site/status-banner";
import { isStaffRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { getStorefrontStatus } from "@/server/storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, status] = await Promise.all([requireUser("/dashboard"), getStorefrontStatus()]);
  return (
    <>
      <StatusBanner status={status} />
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {isStaffRole(user.role) && (
              <Link href="/admin" className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">Admin</Link>
            )}
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:py-10">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <DashboardNav />
          <div className="mt-4 hidden border-t pt-4 lg:block">
            <SignOutButton />
          </div>
        </aside>
        <main id="main" className="min-w-0">{children}</main>
      </div>
      <div className="border-t px-4 py-4 lg:hidden">
        <SignOutButton />
      </div>
    </>
  );
}
