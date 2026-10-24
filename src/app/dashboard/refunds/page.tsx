import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listRefunds } from "@/server/customer/queries";

export const metadata = { title: "Refunds" };

export default async function RefundsPage() {
  const user = await requireUser("/dashboard/refunds");
  const refunds = await listRefunds(user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Refunds</h1>
        <p className="text-sm text-muted-foreground">A refund is marked completed only after the payment provider confirms it.</p>
      </div>
      {refunds.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No refunds" description={<>Questions about a charge? <Link href="/dashboard/support/new" className="underline">Contact support</Link>.</>} />
      ) : (
        <ul className="grid gap-3">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Order <Link href={`/dashboard/orders/${r.order.id}`} className="font-mono underline">{r.order.number}</Link> · requested {formatDateTime(r.createdAt)}
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
