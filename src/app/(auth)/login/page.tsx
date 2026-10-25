import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/login-form";
import { safeNextPath } from "@/lib/safe-redirect";
import { getOptionalUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const MESSAGES: Record<string, string> = {
  account_suspended: "This account has been suspended. Contact support if you think this is a mistake.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const user = await getOptionalUser();
  if (user?.emailVerified && !user.banned) redirect(safeNextPath(next));
  const notice = typeof sp.error === "string" ? MESSAGES[sp.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
        </p>
      </div>
      {sp.reset === "1" && <p className="rounded-lg bg-success-soft px-3 py-2 text-sm">Password updated. Sign in with your new password.</p>}
      {notice && <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">{notice}</p>}
      <LoginForm next={next} />
    </div>
  );
}
