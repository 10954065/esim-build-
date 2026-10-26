import { ChevronDown, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { permissionsFor } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", support: "Support", finance: "Finance" };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireStaff();
  const env = getEnv();
  const permissions = permissionsFor(user.role);
  const demo = env.SUPPLIER_MODE === "sandbox" || env.PAYMENT_PROVIDER === "sandbox";

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-ink text-ink-foreground lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <Logo className="[&>span:first-child]:bg-primary [&>span:first-child>span]:ring-ink [&>span:last-child]:text-white" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminNav permissions={permissions} />
        </div>
        <div className="border-t border-white/10 p-4 text-xs">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-white/55">{user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold tracking-wide text-ink-foreground uppercase">{ROLE_LABEL[user.role] ?? user.role}</span>
            {demo && <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">Demo mode</span>}
            {!user.twoFactorEnabled && (
              <Link href="/dashboard/security" className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
                <ShieldAlert className="size-3.5" aria-hidden /> Enable 2FA (required in production)
              </Link>
            )}
            <Link href="/dashboard" className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted">
              <LogOut className="size-3.5" aria-hidden /> Exit admin
            </Link>
          </div>
          <details className="group border-t lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Admin menu <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="max-h-[60dvh] overflow-y-auto border-t px-2 py-4">
              <AdminNav permissions={permissions} tone="light" />
            </div>
          </details>
        </header>
        <main id="main" className="mx-auto w-full max-w-350 min-w-0 flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
