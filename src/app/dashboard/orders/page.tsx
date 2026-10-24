import { Package } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listOrders } from "@/server/customer/queries";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/orders");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const data = await listOrders(user.id, page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>
      {data.items.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" description="When you buy an eSIM or a number, it appears here." action={<Button asChild size="sm"><Link href="/esims">Browse eSIMs</Link></Button>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/dashboard/orders/${o.id}`} className="font-medium underline-offset-2 hover:underline">{o.number}</Link>
                  </td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2">{o.items[0]?.description} <DemoBadge show={o.isSandbox} /></span></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(o.total.toString(), o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="underline">Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {data.pages}</span>
          {page < data.pages ? <Link href={`?page=${page + 1}`} className="underline">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
