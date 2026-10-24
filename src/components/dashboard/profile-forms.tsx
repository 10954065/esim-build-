"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestAccountDeletionAction, updateProfileAction } from "@/app/dashboard/profile/actions";
import { Field } from "@/components/account/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ name, email, countryCode }: { name: string; email: string; countryCode: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState({ name, countryCode: countryCode ?? "" });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfileAction(values);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <Field id="name" label="Full name">
        <Input id="name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field id="email" label="Email" hint="Contact support to change your email address.">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      <Field id="country" label="Country of residence (optional)" hint="2-letter code, e.g. GH, US, GB.">
        <Input id="country" value={values.countryCode} maxLength={2} onChange={(e) => setValues((v) => ({ ...v, countryCode: e.target.value.toUpperCase() }))} className="w-24 uppercase" />
      </Field>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save changes</Button>
    </form>
  );
}

export function DeletionRequest({ requestedAt }: { requestedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  if (requestedAt) {
    return <p className="text-sm text-muted-foreground">Deletion requested on {new Date(requestedAt).toLocaleDateString()}. We will confirm by email when it is complete.</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestAccountDeletionAction(confirm);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        We will delete or anonymise your personal data. Records we are legally required to keep (payments, refunds, fraud-prevention logs)
        are retained for the required period. Active eSIMs keep working; active numbers stop being visible to you.
      </p>
      <Field id="confirm-delete" label='Type "DELETE" to confirm'>
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-40" autoComplete="off" />
      </Field>
      <Button type="submit" variant="destructive" disabled={pending || confirm !== "DELETE"}>
        {pending && <Loader2 className="animate-spin" />} Request account deletion
      </Button>
    </form>
  );
}
