import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/common/flag";
import { Price, type PriceValue } from "@/components/catalog/price";

export interface BoardRow {
  href: string;
  name: string;
  code: string | null;
  kind: "COUNTRY" | "REGION" | "GLOBAL";
  packageCount: number;
  topSpeed: string | null;
  fromPrice: PriceValue | null;
}

const KIND_CODE = { REGION: "REG", GLOBAL: "GLB" } as const;
const ROW_STAGGER_MS = 70;

/** Airport departure board listing live destinations from the catalogue. Every value is real. */
export function DepartureBoard({ rows }: { rows: BoardRow[] }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/80 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/5 backdrop-blur-sm">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
        <span className="font-heading text-sm font-semibold tracking-[0.18em] text-white uppercase">Departures</span>
        <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-wide text-white/70 uppercase">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-mint" aria-hidden /> Live catalogue
        </span>
      </figcaption>
      <div aria-hidden className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-white/10 px-5 py-2 text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">
        <span>Destination</span>
        <span className="hidden sm:block">Plans</span>
        <span className="text-right">From</span>
      </div>
      <ul>
        {rows.map((r, i) => (
          <li key={r.href} className="animate-flap border-b border-white/5 last:border-0" style={{ animationDelay: `${150 + i * ROW_STAGGER_MS}ms` }}>
            <Link
              href={r.href}
              className="group grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-5 py-3 outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Flag code={r.code} kind={r.kind} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{r.name}</span>
                  <span className="block font-mono text-[11px] tracking-widest text-white/60">
                    {r.kind === "COUNTRY" ? (r.code ?? "") : KIND_CODE[r.kind]}
                    {r.topSpeed ? ` · ${r.topSpeed}` : ""}
                  </span>
                </span>
              </span>
              <span className="hidden font-mono text-sm text-white/70 tabular-nums sm:block">
                {r.packageCount} plan{r.packageCount === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1.5 justify-self-end rounded-md bg-white/5 px-2 py-1 text-sm text-mint ring-1 ring-white/10 transition-colors group-hover:bg-primary group-hover:text-white">
                <span className="sr-only">from </span>
                <Price value={r.fromPrice} className="font-mono text-inherit" unavailableLabel="Unavailable" />
                <ArrowUpRight className="size-3.5 opacity-70" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
