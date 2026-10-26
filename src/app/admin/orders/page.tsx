import Link from "next/link";
import { AdminHeader, Filters, Pager, StatusChips, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge, statusLabel } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listOrders, orderStatusCounts, pages } from "@/server/admin/queries";
import { ORDER_STATUSES } from "@/server/orders/state-machine";

export const metadata = { title: "Orders" };

/** Statuses that wait on staff are highlighted in the chips when they hold orders. */
const URGENT = new Set(["NEEDS_REVIEW"]);

export default async function AdminOrders({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const status = sp1(sp, "status");
  const page = Number(sp1(sp, "page") ?? 1);
  const [data, counts] = await Promise.all([listOrders({ q, status, page }), orderStatusCounts()]);
  const chips = ORDER_STATUSES.flatMap((s) => {
    const count = counts.byStatus.find((c) => c.status === s)?.count ?? 0;
    return count > 0 || s === status ? [{ status: s, count, urgent: URGENT.has(s) }] : [];
  });
  return (
    <>
      <AdminHeader title="Orders" description="Search by order number, customer email, payment reference, gateway transaction or supplier reference." />
      <StatusChips base="/admin/orders" current={status} counts={chips} total={counts.total} labelFor={statusLabel} params={{ q }} />
      <Filters action="/admin/orders" q={q} extra={status && <input type="hidden" name="status" value={status} />} />
      <Table label="Orders" head={["Order", "Customer", "Items", "Status", "Total", "Created"]} empty={data.items.length === 0}>
        {data.items.map((o) => (
          <tr key={o.id}>
            <Td mono><Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary hover:underline">{o.number}</Link> <DemoBadge show={o.isSandbox} /></Td>
            <Td><span title={o.user.email} className="block max-w-44 truncate">{o.user.email}</span></Td>
            <Td><span title={o.items.map((i) => i.description).join(", ")} className="block max-w-44 truncate">{o.items.map((i) => i.description).join(", ")}</span></Td>
            <Td><StatusBadge status={o.status} /></Td>
            <Td className="font-medium tabular-nums">{formatMoney(o.total.toString(), o.currency)}</Td>
            <Td className="text-muted-foreground">{formatDateTime(o.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/orders" params={{ q, status }} />
    </>
  );
}
