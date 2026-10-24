import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { permissionsFor } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireStaff();
  const env = getEnv();
  return (
    <>
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <Logo className="[&_span:last-child]:text-primary-foreground" />
          <span className="rounded bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">Admin · {user.role}</span>
          {(env.SUPPLIER_MODE === "sandbox" || env.PAYMENT_PROVIDER === "sandbox") && (
            <span className="rounded bg-warning px-2 py-0.5 text-xs font-semibold text-primary">DEMO MODE</span>
          )}
          {!user.twoFactorEnabled && <Link href="/dashboard/security" className="text-xs underline">Enable 2FA (required in production)</Link>}
          <Link href="/dashboard" className="ml-auto text-sm opacity-80 hover:opacity-100">Exit admin</Link>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-6 px-4 py-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AdminNav permissions={permissionsFor(user.role)} />
        </aside>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </>
  );
}
