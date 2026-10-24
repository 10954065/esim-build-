import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { listAuditLogs, pages } from "@/server/admin/queries";

export const metadata = { title: "Audit log" };

export default async function AdminAudit({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("audit.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listAuditLogs({ q, page });
  return (
    <>
      <AdminHeader title="Audit log" description="Privileged and financial actions. Metadata is redacted of sensitive values." />
      <Filters action="/admin/audit-logs" q={q} />
      <Table head={["When", "Action", "Actor", "Entity", "Reason", "IP", "Details"]} empty={data.items.length === 0}>
        {data.items.map((a) => (
          <tr key={a.id}>
            <Td className="text-muted-foreground">{formatDateTime(a.createdAt)}</Td>
            <Td mono>{a.action}</Td>
            <Td mono>{a.actorId ? `${a.actorId.slice(0, 10)}… (${a.actorRole ?? "?"})` : "system"}</Td>
            <Td mono>{a.entityType}{a.entityId ? `:${a.entityId.slice(0, 12)}` : ""}</Td>
            <Td className="max-w-xs truncate">{a.reason ?? ""}</Td>
            <Td mono>{a.ipAddress ?? ""}</Td>
            <Td className="max-w-sm truncate font-mono text-[11px]">{a.metadata ? JSON.stringify(a.metadata) : ""}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/audit-logs" params={{ q }} />
    </>
  );
}
