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
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border-2 border-dashed border-warning/50 bg-card p-8">
      <div className="flex items-center gap-2 text-warning">
        <FlaskConical className="size-5" aria-hidden />
        <p className="text-sm font-semibold uppercase tracking-wide">Test payment gateway</p>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{formatMoney(payment.amount.toString(), payment.currency)}</h1>
        <p className="text-sm text-muted-foreground">Order {payment.order.number} · reference {payment.reference}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        This simulates a payment provider. No money is charged and no real product will be issued. Choose an outcome to test.
      </p>
      {payment.status === "INITIALIZED" || payment.status === "PENDING" ? (
        <form action={sandboxPayAction} className="grid gap-2">
          <input type="hidden" name="reference" value={payment.reference} />
          <Button type="submit" name="outcome" value="success" size="lg">Simulate successful payment</Button>
          <Button type="submit" name="outcome" value="failure" size="lg" variant="outline">Simulate declined payment</Button>
        </form>
      ) : (
        <p className="text-sm">This test payment has already been completed ({payment.status.toLowerCase()}).</p>
      )}
    </div>
  );
}
