import { ChevronRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listTickets } from "@/server/customer/queries";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser("/dashboard/support");
  const tickets = await listTickets(user.id);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Help & support"
        title="Support"
        description="Questions about an order, a payment or an eSIM. We reply by email and here."
        actions={
          <Button asChild className="h-10 px-4">
            <Link href="/dashboard/support/new">New ticket</Link>
          </Button>
        }
      />
      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support tickets" description={<>Check the <Link href="/help" className="font-medium text-primary hover:underline">help centre</Link> or open a ticket about any order.</>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/support/${t.id}`} className="surface-interactive flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.subject}</p>
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
