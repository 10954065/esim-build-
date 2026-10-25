import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/password-reset-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  const invalid = !token || sp.error === "INVALID_TOKEN";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      {invalid ? (
        <div className="space-y-3">
          <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">This reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="text-sm font-medium underline">Request a new link</Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </div>
  );
}
