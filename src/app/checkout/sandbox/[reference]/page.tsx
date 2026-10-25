import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { sandboxPayAction } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { isSandboxEnabled } from "@/server/sandbox/ops";

/** SANDBOX GATEWAY PAGE — simulates the hosted payment page. 404 unless sandbox mode is active. */
export default async function SandboxPaymentPage({ params }: { params: Promise<{ reference: string }> }) {
  if (!isSandboxEnabled()) notFound();
  const { reference } = await params;
  const user = await requireUser("/dashboard/orders");
  const payment = await db.payment.findFirst({
    where: { reference: decodeURIComponent(reference), provider: "SANDBOX", order: { userId: user.id } },
    include: { order: { select: { number: true } } },
  });
  if (!payment) notFound();

  return (
    <div className="surface mx-auto max-w-md space-y-6 border-2 border-dashed border-warning/50 p-8">
      <div className="flex items-center gap-2 text-warning">
        <span className="grid size-8 place-items-center rounded-lg bg-warning-soft">
          <FlaskConical className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold tracking-wide uppercase">Test payment gateway</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Amount</p>
        <h1 className="text-3xl font-bold tabular-nums">{formatMoney(payment.amount.toString(), payment.currency)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <span className="font-mono">{payment.order.number}</span> · reference <span className="font-mono break-all">{payment.reference}</span>
        </p>
      </div>
      <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        This simulates a payment provider. No money is charged and no real product will be issued. Choose an outcome to test.
      </p>
      {payment.status === "INITIALIZED" || payment.status === "PENDING" ? (
        <form action={sandboxPayAction} className="grid gap-2">
          <input type="hidden" name="reference" value={payment.reference} />
          <Button type="submit" name="outcome" value="success" size="lg" className="h-11">
            Simulate successful payment
          </Button>
          <Button type="submit" name="outcome" value="failure" size="lg" variant="outline" className="h-11">
            Simulate declined payment
          </Button>
        </form>
      ) : (
        <p className="text-sm">This test payment has already been completed ({payment.status.toLowerCase()}).</p>
      )}
    </div>
  );
}
