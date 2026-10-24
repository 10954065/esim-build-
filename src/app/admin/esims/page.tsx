import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listEsimsForStaff, pages } from "@/server/admin/queries";

export const metadata = { title: "eSIMs" };

export default async function AdminEsims({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listEsimsForStaff({ q, page });
  return (
    <>
      <AdminHeader title="Issued eSIMs" description="Activation codes are never shown to staff; customers retrieve them from their dashboard." />
      <Filters action="/admin/esims" q={q} />
      <Table head={["Order", "Customer", "Plan", "ICCID", "Supplier ref", "Status", "Issued"]} empty={data.items.length === 0}>
        {data.items.map((e) => (
          <tr key={e.id}>
            <Td mono><Link href={`/admin/orders/${e.orderItem.order.id}`} className="underline">{e.orderItem.order.number}</Link> <DemoBadge show={e.isSandbox} /></Td>
            <Td>{e.user.email}</Td>
            <Td className="max-w-xs truncate">{e.orderItem.description}</Td>
            <Td mono>{e.iccid ?? "—"}</Td>
            <Td mono>{e.supplierOrderRef}</Td>
            <Td><StatusBadge status={e.status} /></Td>
            <Td className="text-muted-foreground">{formatDateTime(e.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/esims" params={{ q }} />
    </>
  );
}
