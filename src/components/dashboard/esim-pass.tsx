import { ChevronRight, QrCode, Smartphone } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/common/flag";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/format";

export interface EsimPassData {
  id: string;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  isSandbox: boolean;
  orderItem: {
    description: string;
    product: {
      country: { code: string } | null;
      destination: { kind: "COUNTRY" | "REGION" | "GLOBAL"; country: { code: string } | null } | null;
    };
  };
}

/** A customer's eSIM as a boarding pass; the stub leads to the QR code when it is ready to install. */
export function EsimPass({ e }: { e: EsimPassData }) {
  const dest = e.orderItem.product.destination;
  const code = dest?.country?.code ?? e.orderItem.product.country?.code ?? null;
  const ready = e.status === "READY";
  return (
    <Link
      href={`/dashboard/esims/${e.id}`}
      className="group block rounded-2xl outline-none drop-shadow-[0_1px_2px_rgb(16_24_40/0.06)] transition-[transform,filter] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:drop-shadow-[0_10px_18px_rgb(16_24_40/0.12)] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="ticket flex min-h-32 overflow-hidden text-foreground [--ticket-stub:6rem] sm:[--ticket-stub:7.5rem]">
        <span className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <Flag code={code} kind={dest?.kind ?? "COUNTRY"} size="md" />
              <span className="min-w-0">
                <span className="line-clamp-2 font-heading font-semibold">{e.orderItem.description}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={e.status} />
                  <DemoBadge show={e.isSandbox} />
                </span>
              </span>
            </span>
          </span>
          <span className="mt-auto flex gap-6 text-xs">
            <span>
              <span className="block font-semibold tracking-[0.14em] text-muted-foreground uppercase">Issued</span>
              <span className="mt-0.5 block font-medium">{formatDate(e.createdAt)}</span>
            </span>
            <span>
              <span className="block font-semibold tracking-[0.14em] text-muted-foreground uppercase">Valid until</span>
              <span className="mt-0.5 block font-medium">{e.expiresAt ? formatDate(e.expiresAt) : "Not set yet"}</span>
            </span>
          </span>
        </span>
        <span
          className={
            ready
              ? "flex w-(--stub) shrink-0 flex-col justify-between border-l-2 border-dashed border-white/40 bg-primary p-4 text-primary-foreground"
              : "flex w-(--stub) shrink-0 flex-col justify-between border-l-2 border-dashed border-border bg-muted/60 p-4 transition-colors group-hover:bg-accent"
          }
        >
          {ready ? <QrCode className="size-5" aria-hidden /> : <Smartphone className="size-5 text-primary" aria-hidden />}
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            {ready ? "Install now" : "View details"} <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  );
}
