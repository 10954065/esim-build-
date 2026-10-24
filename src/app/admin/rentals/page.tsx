import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatDateTime, maskPhone } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listRentalsForStaff, pages } from "@/server/admin/queries";

export const metadata = { title: "Rentals" };

export default async function AdminRentals({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listRentalsForStaff({ q, page });
  return (
    <>
      <AdminHeader title="Number rentals" description="Rentals are ordered with auto-renew disabled at the supplier." />
      <Filters action="/admin/rentals" q={q} />
      <Table head={["Order", "Customer", "Number", "Type", "Term", "Messages", "Status", "Expires"]} empty={data.items.length === 0}>
        {data.items.map((r) => (
          <tr key={r.id}>
            <Td mono><Link href={`/admin/orders/${r.orderItem.order.id}`} className="underline">{r.orderItem.order.number}</Link> <DemoBadge show={r.isSandbox} /></Td>
            <Td>{r.user.email}</Td>
            <Td mono>{maskPhone(r.phoneNumber)}</Td>
            <Td>{r.serviceName ?? r.rentalType}</Td>
            <Td>{r.term}</Td>
            <Td>{r._count.messages}</Td>
            <Td><StatusBadge status={r.status} /></Td>
            <Td className="text-muted-foreground">{formatDateTime(r.expiresAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/rentals" params={{ q }} />
    </>
  );
}
