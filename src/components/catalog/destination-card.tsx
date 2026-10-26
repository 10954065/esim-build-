import { ArrowRight, Plane } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/common/flag";
import { Price, type PriceValue } from "./price";
import { SpeedBadge } from "./capabilities";

export interface DestinationCardData {
  slug: string;
  name: string;
  kind: "COUNTRY" | "REGION" | "GLOBAL";
  countryCode: string | null;
  packageCount: number;
  topSpeed: string | null;
  fromPrice: PriceValue | null;
}

const KIND_LABEL = { COUNTRY: "Country", REGION: "Regional plan", GLOBAL: "Global plan" } as const;
const KIND_CODE = { REGION: "REG", GLOBAL: "GLB" } as const;

/** Boarding pass: destination on the main part, the from price on a perforated stub. */
export function DestinationCard({ d }: { d: DestinationCardData }) {
  const code = d.kind === "COUNTRY" ? (d.countryCode ?? "") : KIND_CODE[d.kind];
  return (
    <Link
      href={`/esims/${d.slug}`}
      className="group block rounded-2xl outline-none drop-shadow-[0_1px_2px_rgb(16_24_40/0.06)] transition-[transform,filter] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:drop-shadow-[0_10px_18px_rgb(16_24_40/0.12)] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="ticket flex min-h-36 overflow-hidden text-foreground">
        <span className="flex min-w-0 flex-1 flex-col p-5">
          <span className="flex items-center gap-3">
            <Flag code={d.countryCode} kind={d.kind} size="md" />
            <span className="min-w-0">
              <span className="block truncate font-heading text-lg font-semibold text-foreground">{d.name}</span>
              <span className="block text-xs text-muted-foreground">{KIND_LABEL[d.kind]}</span>
            </span>
          </span>
          <span className="mt-auto flex items-end gap-4 pt-5">
            <span>
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Code</span>
              <span className="font-mono text-xl font-semibold tracking-widest text-foreground">{code}</span>
            </span>
            <span>
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Plans</span>
              <span className="font-mono text-xl font-semibold text-foreground tabular-nums">{d.packageCount}</span>
            </span>
            <span className="ml-auto self-center">
              <SpeedBadge speed={d.topSpeed} />
            </span>
          </span>
        </span>
        <span className="flex w-(--stub) shrink-0 flex-col justify-between border-l-2 border-dashed border-border bg-muted/60 p-4 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Plane className="size-4 text-primary transition-colors group-hover:text-primary-foreground" aria-hidden />
          <span>
            <span className="block text-[10px] font-semibold tracking-[0.14em] uppercase opacity-80">From</span>
            <Price value={d.fromPrice} className="font-heading text-xl text-inherit" unavailableLabel="Unavailable" />
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            View plans <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  );
}
