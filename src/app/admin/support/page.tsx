import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { StatusBadge } from "@/components/common/status-badge";
import { formatRelative } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listTickets, pages } from "@/server/admin/queries";

export const metadata = { title: "Support" };

export default async function AdminSupport({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("support.manage");
  const sp = await searchParams;
  const status = sp1(sp, "status");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listTickets({ status, page });
  return (
    <>
      <AdminHeader title="Support tickets" description="Sorted by priority, oldest first." />
      <Filters action="/admin/support" status={status} statuses={["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]} />
      <Table head={["Ticket", "Subject", "Customer", "Category", "Priority", "Order", "Status", "Updated"]} empty={data.items.length === 0}>
        {data.items.map((t) => (
          <tr key={t.id}>
            <Td mono><Link href={`/admin/support/${t.id}`} className="underline">{t.number}</Link></Td>
            <Td className="max-w-xs truncate">{t.subject}</Td>
            <Td>{t.user.email}</Td>
            <Td>{t.category}</Td>
            <Td>{t.priority}</Td>
            <Td mono>{t.order?.number ?? "—"}</Td>
            <Td><StatusBadge status={t.status} /></Td>
            <Td className="text-muted-foreground">{formatRelative(t.updatedAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/support" params={{ status }} />
    </>
  );
}
