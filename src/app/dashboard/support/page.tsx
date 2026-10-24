import { ChevronRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listTickets } from "@/server/customer/queries";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser("/dashboard/support");
  const tickets = await listTickets(user.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Support</h1>
        <Button asChild size="sm"><Link href="/dashboard/support/new">New ticket</Link></Button>
      </div>
      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support tickets" description={<>Check the <Link href="/help" className="underline">help centre</Link> or open a ticket about any order.</>} />
      ) : (
        <ul className="grid gap-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/support/${t.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-foreground/20">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{t.number}</span>
                    {t.order ? ` · order ${t.order.number}` : ""} · updated {formatRelative(t.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
