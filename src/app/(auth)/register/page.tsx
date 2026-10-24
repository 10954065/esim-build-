import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/account/register-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Already registered? <Link href="/login" className="font-medium text-foreground underline underline-offset-2">Sign in</Link>
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
