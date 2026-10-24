import Link from "next/link";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listPayments, pages } from "@/server/admin/queries";

export const metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("payments.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listPayments({ q, page });
  return (
    <>
      <AdminHeader title="Payments" description="Only gateway references and amounts are stored — never card details." />
      <Filters action="/admin/payments" q={q} />
      <Table head={["Reference", "Order", "Customer", "Gateway", "Gateway txn", "Amount", "Fee", "Status", "Verified"]} empty={data.items.length === 0}>
        {data.items.map((p) => (
          <tr key={p.id}>
            <Td mono>{p.reference}</Td>
            <Td mono><Link href={`/admin/orders/${p.order.id}`} className="underline">{p.order.number}</Link></Td>
            <Td>{p.order.user.email}</Td>
            <Td>{p.provider}</Td>
            <Td mono>{p.gatewayTransactionId ?? "—"}</Td>
            <Td className="tabular-nums">{formatMoney(p.amount.toString(), p.currency)}</Td>
            <Td className="tabular-nums">{p.gatewayFee ? formatMoney(p.gatewayFee.toString(), p.currency) : "—"}</Td>
            <Td><StatusBadge status={p.status} /></Td>
            <Td className="text-muted-foreground">{formatDateTime(p.verifiedAt)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/payments" params={{ q }} />
    </>
  );
}
