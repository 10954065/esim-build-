"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";
import { Field, FormError } from "./field";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

const totpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const target = safeNextPath(next);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const totpForm = useForm<{ code: string }>({ resolver: zodResolver(totpSchema), defaultValues: { code: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    setUnverifiedEmail(null);
    const { data, error: err } = await authClient.signIn.email({ email: values.email, password: values.password, callbackURL: target });
    if (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email);
        return;
      }
      setError(err.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Incorrect email or password.");
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTotp(true);
      return;
    }
    router.replace(target);
    router.refresh();
  }

  async function onVerifyTotp(values: { code: string }) {
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: values.code });
    if (err) {
      setError(err.status === 429 ? "Too many attempts. Please wait and try again." : "That code is not valid.");
      return;
    }
    router.replace(target);
    router.refresh();
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/dashboard" });
    router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}&sent=1`);
  }

  if (needsTotp) {
    return (
      <form onSubmit={totpForm.handleSubmit(onVerifyTotp)} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        <FormError message={error} />
        <Field id="code" label="Authentication code" error={totpForm.formState.errors.code?.message}>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus {...totpForm.register("code")} />
        </Field>
        <Button type="submit" className="w-full" disabled={totpForm.formState.isSubmitting}>
          {totpForm.formState.isSubmitting && <Loader2 className="animate-spin" />} Verify
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={error} />
      {unverifiedEmail && (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
          Please confirm your email address before signing in.{" "}
          <button type="button" onClick={resendVerification} className="font-medium underline">
            Resend the link
          </button>
        </div>
      )}
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" error={form.formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in
      </Button>
    </form>
  );
}
