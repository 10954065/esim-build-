import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listOrders, pages } from "@/server/admin/queries";
import { ORDER_STATUSES } from "@/server/orders/state-machine";

export const metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const status = sp1(sp, "status");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listOrders({ q, status, page });
  return (
    <>
      <AdminHeader title="Orders" description="Search by order number, customer email, payment reference, gateway transaction or supplier reference." />
      <Filters action="/admin/orders" q={q} status={status} statuses={[...ORDER_STATUSES]} />
      <Table head={["Order", "Customer", "Items", "Status", "Total", "Created"]} empty={data.items.length === 0}>
        {data.items.map((o) => (
          <tr key={o.id} className="hover:bg-muted/30">
            <Td mono><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link> <DemoBadge show={o.isSandbox} /></Td>
            <Td><span title={o.user.email} className="block max-w-44 truncate">{o.user.email}</span></Td>
            <Td><span title={o.items.map((i) => i.description).join(", ")} className="block max-w-44 truncate">{o.items.map((i) => i.description).join(", ")}</span></Td>
            <Td><StatusBadge status={o.status} /></Td>
            <Td className="tabular-nums">{formatMoney(o.total.toString(), o.currency)}</Td>
            <Td className="text-muted-foreground">{formatDateTime(o.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/orders" params={{ q, status }} />
    </>
  );
}
