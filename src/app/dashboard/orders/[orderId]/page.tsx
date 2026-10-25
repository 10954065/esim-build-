import { ArrowRight, Check, CreditCard, LifeBuoy, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { DemoBadge, StatusBadge, statusLabel } from "@/components/common/status-badge";
import { AutoRefresh } from "@/components/dashboard/client-utils";
import { OrderItemLabel, ProductTypePill } from "@/components/dashboard/order-item";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getOrder } from "@/server/customer/queries";
import { kickJobs } from "@/server/jobs/kick";

export const metadata = { title: "Order details" };

const PROGRESS_STEPS = ["Placed", "Paid", "Delivering", "Delivered"] as const;
/** Position on the happy path; statuses off that path (failed, refunded, cancelled) show no tracker. */
const PROGRESS_INDEX: Partial<Record<string, number>> = {
  CREATED: 0,
  AWAITING_PAYMENT: 0,
  PAID: 1,
  FULFILLING: 2,
  NEEDS_REVIEW: 2,
  FULFILLED: PROGRESS_STEPS.length,
};

function ProgressTracker({ status }: { status: string }) {
  const current = PROGRESS_INDEX[status];
  if (current === undefined) return null;
  return (
    <ol aria-label="Order progress" className="surface grid grid-cols-4 px-2 py-5 sm:px-5">
      {PROGRESS_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            <span className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : done || active ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-accent text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === PROGRESS_STEPS.length - 1 ? "invisible" : done ? "bg-primary" : "bg-border")} />
            </span>
            <span className={cn("text-xs font-medium", done || active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "border-t pt-3 text-base font-semibold")}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/dashboard/orders/${orderId}`);
  const order = await getOrder(user.id, orderId);
  if (!order) notFound();
  const inProgress = ["AWAITING_PAYMENT", "PAID", "FULFILLING"].includes(order.status);
  // Process due background jobs after this response (cron remains the guaranteed processor).
  if (order.status === "PAID" || order.status === "FULFILLING") kickJobs(5);
  const pendingPayment = order.payments.find((p) => p.status === "INITIALIZED" || p.status === "PENDING");
  const money = (v: { toString(): string }) => formatMoney(v.toString(), order.currency);

  return (
    <div className="space-y-6">
      <AutoRefresh active={inProgress} seconds={6} />
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Orders", href: "/dashboard/orders" }, { label: order.number }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold text-primary">{order.number}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
            Order details <DemoBadge show={order.isSandbox} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      <ProgressTracker status={order.status} />

      {order.status === "AWAITING_PAYMENT" && pendingPayment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <p>We have not received a confirmed payment for this order yet.</p>
          <Button asChild size="sm">
            <Link href={`/checkout/return?reference=${pendingPayment.reference}`}>Check payment status</Link>
          </Button>
        </div>
      )}
      {order.status === "NEEDS_REVIEW" && (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          Your payment is confirmed but our supplier has not completed the order yet. Our team is reviewing it and will either complete it or refund you in
          full. No action is needed from you.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section aria-labelledby="items-heading" className="surface overflow-hidden">
            <h2 id="items-heading" className="border-b px-5 py-4 font-semibold">
              Items
            </h2>
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
                    <div className="min-w-0 flex-1 space-y-1">
                      <OrderItemLabel item={item} className="font-semibold" />
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <ProductTypePill type={item.productType} />
                        Qty {item.quantity} · Delivery: {item.fulfilment ? statusLabel(item.fulfilment.status) : "not started"}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{money(item.total)}</span>
                    {link && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={link}>
                          Open <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="timeline-heading" className="surface p-5">
            <h2 id="timeline-heading" className="font-semibold">
              Timeline
            </h2>
            <ol className="mt-4">
              {order.history.map((h, i) => (
                <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < order.history.length - 1 && <span aria-hidden className="absolute top-4 left-1.25 h-full w-0.5 -translate-x-1/4 bg-primary/40" />}
                  <span aria-hidden className="relative mt-1.5 size-2.75 shrink-0 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
                  <div className="text-sm">
                    <p className="font-medium">{statusLabel(h.toStatus)}</p>
                    {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:h-fit">
          <section aria-labelledby="summary-heading" className="surface p-5">
            <h2 id="summary-heading" className="font-semibold">
              Summary
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <MoneyRow label="Subtotal" value={money(order.subtotal)} />
              {Number(order.discountTotal) > 0 && <MoneyRow label="Discount" value={`−${money(order.discountTotal)}`} />}
              {Number(order.taxTotal) > 0 && <MoneyRow label="Tax" value={money(order.taxTotal)} />}
              <MoneyRow label="Total" value={money(order.total)} strong />
            </dl>
          </section>

          <section aria-labelledby="payments-heading" className="surface overflow-hidden">
            <h2 id="payments-heading" className="border-b px-5 py-4 font-semibold">
              Payments &amp; refunds
            </h2>
            <ul className="divide-y text-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 gap-2.5">
                    <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">{p.provider === "SANDBOX" ? "Test gateway" : "Paystack"}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{p.reference}</p>
                      {p.failureReason && <p className="text-xs text-destructive">{p.failureReason}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <p className="tabular-nums">{formatMoney(p.amount.toString(), p.currency)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
              {order.refunds.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 gap-2.5">
                    <RotateCcw className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">Refund</p>
                      <p className="text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <p className="tabular-nums">−{formatMoney(r.amount.toString(), r.currency)}</p>
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <Link href={`/dashboard/support/new?order=${order.id}`} className="surface-interactive flex items-center gap-3 p-4 text-sm">
            <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
              <LifeBuoy className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">Problem with this order?</span>
              <span className="text-xs text-muted-foreground">Contact support</span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
