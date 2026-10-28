import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav, SignOutButton } from "@/components/dashboard/dashboard-nav";
import { HomeLink } from "@/components/site/home-link";
import { Logo } from "@/components/site/logo";
import { StatusBanner } from "@/components/site/status-banner";
import { isStaffRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { getStorefrontStatus } from "@/server/storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" }, robots: { index: false, follow: false } };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, status] = await Promise.all([requireUser("/dashboard"), getStorefrontStatus()]);
  const avatar = (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">
      {initials(user.name) || "?"}
    </span>
  );

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="px-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Services & account</p>
          <DashboardNav className="mt-2" />
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-3 px-1">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <SignOutButton className="mt-3 w-full" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <StatusBanner status={status} />
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <span className="hidden rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground lg:inline">Customer dashboard</span>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <HomeLink />
              {isStaffRole(user.role) && (
                <Link href="/admin" className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                  Admin
                </Link>
              )}
              <Link href="/esims" className="hidden items-center gap-1 font-semibold text-primary hover:underline sm:inline-flex">
                <Plus className="size-4" aria-hidden /> Buy eSIM
              </Link>
              <span className="lg:hidden">{avatar}</span>
            </div>
          </div>
          <div className="border-t px-4 py-2 lg:hidden">
            <DashboardNav />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
        <div className="border-t px-4 py-4 lg:hidden">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
