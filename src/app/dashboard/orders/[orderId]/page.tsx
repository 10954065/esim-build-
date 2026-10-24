import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge, StatusBadge, statusLabel } from "@/components/common/status-badge";
import { AutoRefresh } from "@/components/dashboard/client-utils";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOrder } from "@/server/customer/queries";
import { kickJobs } from "@/server/jobs/kick";

export const metadata = { title: "Order details" };

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/dashboard/orders/${orderId}`);
  const order = await getOrder(user.id, orderId);
  if (!order) notFound();
  const inProgress = ["AWAITING_PAYMENT", "PAID", "FULFILLING"].includes(order.status);
  // Process due background jobs after this response (cron remains the guaranteed processor).
  if (order.status === "PAID" || order.status === "FULFILLING") kickJobs(5);
  const pendingPayment = order.payments.find((p) => p.status === "INITIALIZED" || p.status === "PENDING");

  return (
    <div className="space-y-6">
      <AutoRefresh active={inProgress} seconds={6} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{order.number}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            Order details <DemoBadge show={order.isSandbox} />
          </h1>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      {order.status === "AWAITING_PAYMENT" && pendingPayment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <p>We have not received a confirmed payment for this order yet.</p>
          <Button asChild size="sm"><Link href={`/checkout/return?reference=${pendingPayment.reference}`}>Check payment status</Link></Button>
        </div>
      )}
      {order.status === "NEEDS_REVIEW" && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          Your payment is confirmed but our supplier has not completed the order yet. Our team is reviewing it and will either complete
          it or refund you in full. No action is needed from you.
        </div>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-5 py-3 font-semibold">Items</h2>
        <ul className="divide-y">
          {order.items.map((item) => {
            const link = item.esims[0]
              ? `/dashboard/esims/${item.esims[0].id}`
              : item.verification
                ? `/dashboard/verification/${item.verification.id}`
                : item.rental
                  ? "/dashboard/rentals"
                  : null;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty {item.quantity} · Fulfilment: {item.fulfilment ? statusLabel(item.fulfilment.status) : "not started"}
                  </p>
                </div>
                <span className="tabular-nums">{formatMoney(item.total.toString(), order.currency)}</span>
                {link && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={link}>Open <ArrowRight /></Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <dl className="space-y-1 border-t px-5 py-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotal.toString(), order.currency)}</dd></div>
          {Number(order.discountTotal) > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{formatMoney(order.discountTotal.toString(), order.currency)}</dd></div>
          )}
          {Number(order.taxTotal) > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{formatMoney(order.taxTotal.toString(), order.currency)}</dd></div>
          )}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.total.toString(), order.currency)}</dd></div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3 font-semibold">Payments & refunds</h2>
          <ul className="divide-y text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p>Payment · {p.provider === "SANDBOX" ? "Test gateway" : "Paystack"}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.reference}</p>
                  {p.failureReason && <p className="text-xs text-destructive">{p.failureReason}</p>}
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{formatMoney(p.amount.toString(), p.currency)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
            {order.refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p>Refund</p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">−{formatMoney(r.amount.toString(), r.currency)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3 font-semibold">Timeline</h2>
          <ol className="space-y-3 px-5 py-4">
            {order.history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <div>
                  <p className="font-medium">{statusLabel(h.toStatus)}</p>
                  {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <p className="text-sm text-muted-foreground">
        Problem with this order? <Link href={`/dashboard/support/new?order=${order.id}`} className="font-medium text-foreground underline">Contact support</Link>
      </p>
    </div>
  );
}
