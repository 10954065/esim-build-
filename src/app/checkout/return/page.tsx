import { CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/dashboard/client-utils";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { confirmPayment } from "@/server/payments/confirm";

/**
 * Return URL after the hosted payment page. The browser redirect itself proves nothing:
 * this page asks our server to verify the payment with the gateway (idempotent).
 */
export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : "";
  const user = await requireUser("/dashboard/orders");
  const payment = reference ? await db.payment.findFirst({ where: { reference, order: { userId: user.id } }, select: { reference: true, orderId: true } }) : null;
  if (!payment) notFound();

  let outcome: string = "pending";
  try {
    outcome = (await confirmPayment(payment.reference, "return")).outcome;
  } catch (err) {
    logger.warn("payment verification on return failed", { orderId: payment.orderId, err });
  }
  const paid = outcome === "paid" || outcome === "already_paid";
  const failed = outcome === "failed" || outcome === "abandoned";

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-card p-8 text-center">
      <AutoRefresh active={!paid && !failed} seconds={4} />
      {paid ? (
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
      ) : failed ? (
        <XCircle className="mx-auto size-10 text-destructive" aria-hidden />
      ) : (
        <Clock className="mx-auto size-10 text-warning" aria-hidden />
      )}
      <h1 className="text-xl font-semibold">
        {paid ? "Payment confirmed" : failed ? "Payment was not completed" : outcome === "mismatch" ? "Payment under review" : "Confirming your payment…"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {paid
          ? "We verified your payment with the payment provider and are preparing your order now."
          : failed
            ? "No money was taken for this order. You can start a new checkout at any time."
            : outcome === "mismatch"
              ? "The amount we received does not match your order. Our team will review it and contact you."
              : "This usually takes a few seconds. This page updates automatically."}
      </p>
      <Button asChild>
        <Link href={`/dashboard/orders/${payment.orderId}`}>View order</Link>
      </Button>
    </div>
  );
}
