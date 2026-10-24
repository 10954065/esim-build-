import { ChevronRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
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
      <h1 className="text-2xl font-semibold">My eSIMs</h1>
      {esims.length === 0 ? (
        <EmptyState icon={Smartphone} title="No eSIMs yet" description="Purchased eSIMs and their installation details appear here." action={<Button asChild size="sm"><Link href="/esims">Find a plan</Link></Button>} />
      ) : (
        <ul className="grid gap-3">
          {esims.map((e) => (
            <li key={e.id}>
              <Link href={`/dashboard/esims/${e.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-foreground/20">
                <span className="grid size-10 place-items-center rounded-lg bg-muted"><Smartphone className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">{e.orderItem.description} <DemoBadge show={e.isSandbox} /></p>
                  <p className="text-xs text-muted-foreground">
                    Order {e.orderItem.order.number} · Issued {formatDate(e.createdAt)}
                    {e.iccid ? ` · ICCID ••••${e.iccid.slice(-4)}` : ""}
                  </p>
                </div>
                <StatusBadge status={e.status} />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
