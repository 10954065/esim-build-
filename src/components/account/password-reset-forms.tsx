"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Field, FormError } from "./field";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.email("Enter a valid email") })),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: { email: string }) {
    // Always show the same confirmation, whether or not the account exists.
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-success" aria-hidden />
        <p className="text-sm text-muted-foreground">If an account exists for that email, we have sent a password reset link. It expires in 1 hour.</p>
        <Link href="/login" className="text-sm font-medium underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Send reset link
      </Button>
    </form>
  );
}

const resetSchema = z
  .object({ password: z.string().min(10, "Use at least 10 characters").max(128), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });

  async function onSubmit({ password }: { password: string }) {
    setError(null);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    if (err) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }
    router.replace("/login?reset=1");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={error} />
      <Field id="password" label="New password" error={form.formState.errors.password?.message} hint="At least 10 characters.">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirm" label="Confirm new password" error={form.formState.errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Update password
      </Button>
      <p className="text-xs text-muted-foreground">For your security, all other sessions will be signed out.</p>
    </form>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setState(error ? "error" : "sent");
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" onClick={resend} disabled={state === "sending" || !email}>
        {state === "sending" && <Loader2 className="animate-spin" />} Resend confirmation email
      </Button>
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">
        {state === "sent" && "If the account needs confirmation, a new link is on its way."}
        {state === "error" && "Please wait a little before requesting another email."}
      </p>
    </div>
  );
}
