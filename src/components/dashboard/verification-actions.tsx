"use client";

import { FlaskConical, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelVerificationAction,
  refreshVerificationAction,
  simulateRentalSmsAction,
  simulateSmsAction,
  type VerificationActionResult,
} from "@/app/dashboard/verification/actions";
import { Button } from "@/components/ui/button";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<VerificationActionResult>, quiet = false) =>
    start(async () => {
      const r = await fn();
      if (r.ok && !quiet) toast.success(r.message);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  return { pending, run };
}

export function VerificationActions({
  verificationId,
  canCancel,
  live,
  sandbox,
}: {
  verificationId: string;
  canCancel: boolean;
  live: boolean;
  sandbox: boolean;
}) {
  const { pending, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {live && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => refreshVerificationAction(verificationId), true)}>
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check now
        </Button>
      )}
      {live && sandbox && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => simulateSmsAction(verificationId))}>
          <FlaskConical /> Simulate SMS (demo)
        </Button>
      )}
      {canCancel &&
        (confirming ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              run(() => cancelVerificationAction(verificationId));
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <XCircle />} Confirm cancel
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Cancel number
          </Button>
        ))}
    </>
  );
}

export function RentalDemoSms({ rentalId }: { rentalId: string }) {
  const { pending, run } = useAction();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => simulateRentalSmsAction(rentalId))}>
      <FlaskConical /> Simulate SMS (demo)
    </Button>
  );
}
