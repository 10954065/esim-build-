import { CreditCard } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listPayments } from "@/server/customer/queries";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const user = await requireUser("/dashboard/transactions");
  const payments = await listPayments(user.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Transactions" description="Every payment attempt and its verified status." />
      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No transactions yet" />
      ) : (
        <div className="surface relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted text-left text-xs tracking-[0.06em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Method</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/orders/${p.order.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{p.order.number}</Link> <DemoBadge show={p.order.isSandbox} />
                  </td>
                  <td className="px-4 py-3">{p.provider === "SANDBOX" ? "Test gateway" : (p.channel ?? "Paystack")}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.amount.toString(), p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
