import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your account email and we will send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="block text-center text-sm text-muted-foreground underline-offset-2 hover:underline">Back to sign in</Link>
    </div>
  );
}
