"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { registerAction } from "@/app/(auth)/register/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "./field";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: z.email("Enter a valid email").max(254),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms and acceptable use policy"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "", acceptTerms: false },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const result = await registerAction({
      name: values.name,
      email: values.email,
      password: values.password,
      acceptTerms: values.acceptTerms as true,
    });
    if (!result.ok) {
      setError(result.error);
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) form.setError(k as keyof Values, { message: v });
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          If <strong className="text-foreground">{sentTo}</strong> can be registered, we have sent a confirmation link. Open it to
          activate your account.
        </p>
        <Link href="/login" className="text-sm font-medium underline">Back to sign in</Link>
      </div>
    );
  }

  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={error} />
      <Field id="name" label="Full name" error={e.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!e.name} {...form.register("name")} />
      </Field>
      <Field id="email" label="Email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" error={e.password?.message} hint="At least 10 characters.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
      </Field>
      <Field id="confirm" label="Confirm password" error={e.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!e.confirm} {...form.register("confirm")} />
      </Field>
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" {...form.register("acceptTerms")} />
          <span>
            I agree to the <Link href="/terms" className="underline">terms of service</Link> and{" "}
            <Link href="/acceptable-use" className="underline">acceptable use policy</Link>.
          </span>
        </label>
        {e.acceptTerms && <p role="alert" className="text-xs font-medium text-destructive">{e.acceptTerms.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Create account
      </Button>
    </form>
  );
}
