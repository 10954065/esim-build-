import { ArrowUpRight, Globe2, Map } from "lucide-react";
import Link from "next/link";
import { flagEmoji } from "@/lib/slug";
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

export function DestinationCard({ d }: { d: DestinationCardData }) {
  return (
    <Link
      href={`/esims/${d.slug}`}
      className="group relative flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-2xl" aria-hidden>
        {d.kind === "COUNTRY" ? flagEmoji(d.countryCode) : d.kind === "GLOBAL" ? <Globe2 className="size-5" /> : <Map className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{d.name}</span>
          <SpeedBadge speed={d.topSpeed} />
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {d.packageCount} plan{d.packageCount === 1 ? "" : "s"} · from <Price value={d.fromPrice} className="text-foreground" unavailableLabel="—" />
        </span>
      </span>
      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
