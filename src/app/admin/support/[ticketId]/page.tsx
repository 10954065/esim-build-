import Link from "next/link";
import { notFound } from "next/navigation";
import { setTicketStatusAction, staffReplyAction } from "@/app/admin/actions";
import { AdminHeader } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/session";
import { getTicketForStaff } from "@/server/admin/queries";
import { isUuid } from "@/server/customer/queries";

export const metadata = { title: "Ticket" };

export default async function AdminTicket({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: SearchParams }) {
  await requireStaff("support.manage");
  const [{ ticketId }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(ticketId)) notFound();
  const t = await getTicketForStaff(ticketId);
  if (!t) notFound();
  const back = `/admin/support/${t.id}`;
  return (
    <div className="max-w-4xl">
      <AdminHeader
        title={t.subject}
        description={<>{t.number} · {t.category} · {t.priority} · {t.user.email}{t.order && <> · order <Link href={`/admin/orders/${t.order.id}`} className="underline">{t.order.number}</Link> ({t.order.status})</>}</>}
        actions={<StatusBadge status={t.status} className="text-sm" />}
      />
      <ActionNotice sp={sp} />
      <ol className="space-y-3">
        {t.messages.map((m) => (
          <li key={m.id} className={cn("rounded-xl border p-4", m.isInternal ? "border-warning/40 bg-warning-soft" : m.isStaff ? "border-primary/15 bg-accent" : "bg-card")}>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{m.isInternal ? "Internal note" : m.isStaff ? "Staff" : "Customer"} · {m.author.name}</span>
              <span>{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </li>
        ))}
      </ol>
      <form action={staffReplyAction} className="mt-6 space-y-2">
        <input type="hidden" name="ticketId" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <textarea name="body" required rows={5} maxLength={5000} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Reply to the customer, or add an internal note…" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" /> Internal note (not visible to customer)</label>
          <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Send</button>
        </div>
      </form>
      <form action={setTicketStatusAction} className="mt-4 flex items-center gap-2">
        <input type="hidden" name="ticketId" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <select name="status" defaultValue={t.status} className="h-9 rounded-md border bg-background px-2 text-sm">
          {["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="h-9 rounded-md border px-3 text-sm">Update status</button>
      </form>
    </div>
  );
}
