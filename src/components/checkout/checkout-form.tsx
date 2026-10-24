"use client";

import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createCheckoutAction, type CheckoutActionState } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";

export function CheckoutForm({ productId, days, promoCode, payLabel }: { productId: string; days?: number; promoCode?: string; payLabel: string }) {
  // One idempotency key per checkout attempt: double-clicks or resubmits reuse the same order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<CheckoutActionState, FormData>(createCheckoutAction, { error: null });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {days && <input type="hidden" name="days" value={days} />}
      {promoCode && <input type="hidden" name="promoCode" value={promoCode} />}
      {state.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4" />
        <span>
          I have checked device compatibility (for eSIMs) and agree to the <Link href="/terms" className="underline">terms</Link>,{" "}
          <Link href="/refund-policy" className="underline">refund policy</Link> and <Link href="/acceptable-use" className="underline">acceptable use policy</Link>.
        </span>
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Lock />} {payLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You will complete payment on the payment provider&apos;s secure page.</p>
    </form>
  );
}
