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

  const tone = paid ? "bg-success-soft text-success" : failed ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning";
  const Icon = paid ? CheckCircle2 : failed ? XCircle : Clock;

  return (
    <div className="surface mx-auto max-w-lg space-y-4 p-8 text-center shadow-raised">
      <AutoRefresh active={!paid && !failed} seconds={4} />
      <span className={`mx-auto grid size-16 place-items-center rounded-full ${tone}`}>
        <Icon className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">
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
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button asChild className="h-10 px-5">
          <Link href={`/dashboard/orders/${payment.orderId}`}>View order</Link>
        </Button>
        {failed && (
          <Button asChild variant="outline" className="h-10 px-5">
            <Link href="/esims">Back to the store</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
