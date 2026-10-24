import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listRefunds, pages } from "@/server/admin/queries";

export const metadata = { title: "Refunds" };

export default async function AdminRefunds({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("payments.read");
  const sp = await searchParams;
  const status = sp1(sp, "status");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listRefunds({ status, page });
  return (
    <>
      <AdminHeader title="Refunds" description="Refunds are issued from an order page. A refund is completed only when the payment provider confirms it." />
      <Filters action="/admin/refunds" status={status} statuses={["REQUESTED", "PENDING", "COMPLETED", "FAILED", "REJECTED"]} />
      <Table head={["Order", "Customer", "Amount", "Reason", "Initiated by", "Gateway ref", "Status", "Requested", "Completed"]} empty={data.items.length === 0}>
        {data.items.map((r) => (
          <tr key={r.id}>
            <Td mono><Link href={`/admin/orders/${r.order.id}`} className="underline">{r.order.number}</Link></Td>
            <Td>{r.order.user.email}</Td>
            <Td className="tabular-nums">{formatMoney(r.amount.toString(), r.currency)}</Td>
            <Td className="max-w-xs truncate">{r.reason}{r.failureReason ? ` — ${r.failureReason}` : ""}</Td>
            <Td>{r.initiatedByType}</Td>
            <Td mono>{r.gatewayRefundId ?? "—"}</Td>
            <Td><StatusBadge status={r.status} /></Td>
            <Td className="text-muted-foreground">{formatDateTime(r.createdAt)}</Td>
            <Td className="text-muted-foreground">{formatDateTime(r.completedAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/refunds" params={{ status }} />
    </>
  );
}
