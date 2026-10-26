import { PhoneCall } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { AutoRefresh, CopyButton } from "@/components/dashboard/client-utils";
import { RentalDemoSms } from "@/components/dashboard/verification-actions";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTerm } from "@/lib/format";
import { Flag } from "@/components/common/flag";
import { requireUser } from "@/server/auth/session";
import { listRentals } from "@/server/customer/queries";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Rentals" };

export default async function RentalsPage() {
  const user = await requireUser("/dashboard/rentals");
  const rentals = await listRentals(user.id);
  const anyActive = rentals.some((r) => r.status === "ACTIVE" && r.expiresAt > new Date());

  return (
    <div className="space-y-6">
      <AutoRefresh active={anyActive} seconds={15} />
      <PageHeader eyebrow="Long term numbers" title="Number rentals" description="Numbers you rent and every message they receive." actions={<Button asChild className="h-10 px-4"><Link href="/numbers/rentals">Rent a number</Link></Button>} />
      {rentals.length === 0 ? (
        <EmptyState icon={PhoneCall} title="No rentals yet" description="Long term numbers you rent appear here with their messages." action={<Button asChild size="sm"><Link href="/numbers/rentals">Rent a number</Link></Button>} />
      ) : (
        <div className="space-y-4">
          {rentals.map((r) => (
            <section key={r.id} className="surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 border-b px-5 py-4">
                <Flag code={r.countryCode} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-mono text-lg font-semibold">{r.phoneNumber} <DemoBadge show={r.isSandbox} /></p>
                  <p className="text-xs text-muted-foreground">
                    {r.serviceName ? `${r.serviceName} only` : "All services"} · {formatTerm(r.term)} · expires {formatDateTime(r.expiresAt)} · order{" "}
                    <Link href={`/dashboard/orders/${r.orderItem.order.id}`} className="font-mono text-foreground hover:text-primary hover:underline">{r.orderItem.order.number}</Link>
                  </p>
                </div>
                <StatusBadge status={r.status} />
                <CopyButton value={r.phoneNumber} label="Copy" />
                {r.isSandbox && r.status === "ACTIVE" && <RentalDemoSms rentalId={r.id} />}
              </div>
              {r.messages.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <ul className="divide-y">
                  {r.messages.map((m) => (
                    <li key={m.id} className="px-5 py-3 text-sm">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{m.sender ?? "Unknown sender"}</span>
                        <span>{formatDateTime(m.receivedAt)}</span>
                      </div>
                      {m.code && <p className="mt-1.5 inline-block rounded-lg bg-accent px-2.5 py-1 font-mono text-lg font-semibold tracking-widest text-primary">{m.code}</p>}
                      <p className="mt-1">{m.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <p className="text-xs text-muted-foreground">Rentals never renew automatically. We email you before a rental expires.</p>
        </div>
      )}
    </div>
  );
}
