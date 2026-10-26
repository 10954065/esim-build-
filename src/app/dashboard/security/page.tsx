import { ChangePasswordForm, SessionsPanel, TwoFactorPanel } from "@/components/dashboard/account-safety";
import { isStaffRole } from "@/server/auth/permissions";
import { getSession, requireUser } from "@/server/auth/session";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/security");
  const session = await getSession();
  const sp = await searchParams;
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader eyebrow="Account" title="Security" description="Password, two factor authentication and the devices you are signed in on." />
      {sp.require2fa === "1" && isStaffRole(user.role) && (
        <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          Staff accounts must turn on two factor authentication before using the admin dashboard.
        </p>
      )}
      <section className="surface p-6">
        <h2 className="mb-4 font-semibold">Password</h2>
        <ChangePasswordForm />
      </section>
      <section className="surface p-6">
        <h2 className="mb-1 font-semibold">Two factor authentication</h2>
        <p className="mb-4 text-sm text-muted-foreground">Protect your account with a code from an authenticator app when signing in.</p>
        <TwoFactorPanel enabled={user.twoFactorEnabled} />
      </section>
      <section className="surface p-6">
        <h2 className="mb-4 font-semibold">Active sessions</h2>
        <SessionsPanel currentToken={session?.session.token ?? ""} />
      </section>
    </div>
  );
}
