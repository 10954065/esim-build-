import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendVerification } from "@/components/account/password-reset-forms";
import { getOptionalUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getOptionalUser();
  if (user?.emailVerified) redirect("/dashboard");
  const email = user?.email ?? (typeof sp.email === "string" ? sp.email.slice(0, 254) : "");
  const failed = typeof sp.error === "string";

  return (
    <div className="space-y-6 text-center">
      <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Confirm your email</h1>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">That confirmation link is invalid or has expired. Request a new one below.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : ""}. Open it to activate your
            account. The link expires in 24 hours.
          </p>
        )}
      </div>
      {email && <ResendVerification email={email} />}
      <Link href="/login" className="block text-sm text-muted-foreground underline-offset-2 hover:underline">Back to sign in</Link>
    </div>
  );
}
