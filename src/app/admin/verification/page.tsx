import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatDateTime, maskPhone } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listVerificationsForStaff, pages } from "@/server/admin/queries";

export const metadata = { title: "Verification sessions" };

export default async function AdminVerification({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listVerificationsForStaff({ q, page });
  return (
    <>
      <AdminHeader title="Verification sessions" description="SMS content is private to the customer; staff see message counts only." />
      <Filters action="/admin/verification" q={q} />
      <Table head={["Order", "Customer", "Service", "Country", "Number", "Supplier ref", "Messages", "Status", "Expires"]} empty={data.items.length === 0}>
        {data.items.map((v) => (
          <tr key={v.id}>
            <Td mono><Link href={`/admin/orders/${v.orderItem.order.id}`} className="underline">{v.orderItem.order.number}</Link> <DemoBadge show={v.isSandbox} /></Td>
            <Td>{v.user.email}</Td>
            <Td>{v.serviceName}</Td>
            <Td>{v.countryCode}</Td>
            <Td mono>{maskPhone(v.phoneNumber)}</Td>
            <Td mono>{v.supplierOrderRef.slice(0, 24)}</Td>
            <Td>{v._count.messages}</Td>
            <Td><StatusBadge status={v.status} /></Td>
            <Td className="text-muted-foreground">{formatDateTime(v.expiresAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/verification" params={{ q }} />
    </>
  );
}
