import { ArrowRight } from "lucide-react";
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

export function DestinationCard({ d }: { d: DestinationCardData }) {
  const subtitle = d.kind === "COUNTRY" && d.countryCode ? `${KIND_LABEL.COUNTRY} · ISO ${d.countryCode}` : KIND_LABEL[d.kind];
  return (
    <Link href={`/esims/${d.slug}`} className="group surface-interactive flex flex-col p-5 focus-visible:ring-3 focus-visible:ring-ring/40">
      <span className="flex items-start gap-3">
        <Flag code={d.countryCode} kind={d.kind} size="md" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground">{d.name}</span>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <SpeedBadge speed={d.topSpeed} />
      </span>
      <span className="mt-5 flex items-baseline gap-1.5">
        <span className="text-xs text-muted-foreground">From</span>
        <Price value={d.fromPrice} className="text-xl text-foreground" unavailableLabel="—" />
      </span>
      <span className="mt-1 text-xs font-medium text-success">
        {d.packageCount} plan{d.packageCount === 1 ? "" : "s"} available
      </span>
      <span className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-card text-sm font-medium text-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
        View plans <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
