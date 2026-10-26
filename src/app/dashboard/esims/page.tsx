import { ChevronRight, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listEsims } from "@/server/customer/queries";

export const metadata = { title: "My eSIMs" };

export default async function EsimsPage() {
  const user = await requireUser("/dashboard/esims");
  const esims = await listEsims(user.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Travel data</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My eSIMs</h1>
          <p className="mt-1 text-muted-foreground">Installation codes and plan details for every eSIM you have bought.</p>
        </div>
        <Button asChild className="h-10 px-4">
          <Link href="/esims">
            <Plus /> Buy an eSIM
          </Link>
        </Button>
      </div>
      {esims.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No eSIMs yet"
          description="Purchased eSIMs and their installation details appear here."
          action={
            <Button asChild size="sm">
              <Link href="/esims">Find a plan</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {esims.map((e) => {
            const dest = e.orderItem.product.destination;
            return (
              <li key={e.id}>
                <Link href={`/dashboard/esims/${e.id}`} className="surface-interactive group flex h-full flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Flag code={dest?.country?.code} kind={dest?.kind ?? "COUNTRY"} size="md" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                          {e.orderItem.description} <DemoBadge show={e.isSandbox} />
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">{e.orderItem.order.number}</span>
                      </span>
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                  <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Issued</dt>
                      <dd className="mt-0.5 font-medium">{formatDate(e.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Expires</dt>
                      <dd className="mt-0.5 font-medium">{e.expiresAt ? formatDate(e.expiresAt) : "Not yet"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ICCID</dt>
                      <dd className="mt-0.5 font-mono font-medium">{e.iccid ? `••••${e.iccid.slice(-4)}` : "Pending"}</dd>
                    </div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Installation details <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
