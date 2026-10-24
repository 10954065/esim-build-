import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/common/status-badge";
import { ReplyForm } from "@/components/dashboard/support-forms";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getTicket } from "@/server/customer/queries";

export const metadata = { title: "Support ticket" };

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const user = await requireUser(`/dashboard/support/${ticketId}`);
  const ticket = await getTicket(user.id, ticketId);
  if (!ticket) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{ticket.number}</p>
          <h1 className="mt-1 text-2xl font-semibold">{ticket.subject}</h1>
          {ticket.order && (
            <p className="text-sm text-muted-foreground">
              Order <Link href={`/dashboard/orders/${ticket.order.id}`} className="font-mono underline">{ticket.order.number}</Link>
            </p>
          )}
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <ol className="space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id} className={cn("rounded-xl border p-4", m.isStaff ? "bg-brand-soft/40" : "bg-card")}>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.isStaff ? "Support team" : "You"}</span>
              <time dateTime={m.createdAt.toISOString()}>{formatDateTime(m.createdAt)}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </li>
        ))}
      </ol>
      {ticket.status !== "CLOSED" ? <ReplyForm ticketId={ticket.id} /> : <p className="text-sm text-muted-foreground">This ticket is closed.</p>}
    </div>
  );
}
