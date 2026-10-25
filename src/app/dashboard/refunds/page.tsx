import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listRefunds } from "@/server/customer/queries";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Refunds" };

export default async function RefundsPage() {
  const user = await requireUser("/dashboard/refunds");
  const refunds = await listRefunds(user.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Refunds" description="A refund is marked completed only after the payment provider confirms it." />
      {refunds.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No refunds" description={<>Questions about a charge? <Link href="/dashboard/support/new" className="font-medium text-primary hover:underline">Contact support</Link>.</>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {refunds.map((r) => (
            <li key={r.id} className="surface flex flex-wrap items-center gap-4 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Order <Link href={`/dashboard/orders/${r.order.id}`} className="font-mono text-foreground hover:text-primary hover:underline">{r.order.number}</Link> · requested {formatDateTime(r.createdAt)}
                  {r.completedAt ? ` · completed ${formatDateTime(r.completedAt)}` : ""}
                </p>
              </div>
              <StatusBadge status={r.status} />
              <span className="font-semibold tabular-nums">{formatMoney(r.amount.toString(), r.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
