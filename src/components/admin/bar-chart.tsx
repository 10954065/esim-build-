import type { ReactNode } from "react";
import { axisTickIndexes, scaleToMax } from "@/lib/charts";
import { cn } from "@/lib/utils";

/** How many columns at each end anchor their hover label to that side. */
const EDGE_COLUMNS = 3;

export interface BarPoint {
  key: string;
  /** Axis and tooltip label, e.g. "24 Oct". */
  label: string;
  value: number;
  /** Formatted value for the tooltip, e.g. "$12.00" or "3 orders". */
  display: string;
}

/**
 * Column chart drawn with plain HTML so it scales cleanly at any width.
 * Hovering a column shows its day and value. The chart itself is hidden from
 * screen readers; `summary` (and the figures stated next to every chart) carry the data.
 */
export function BarChart({ points, summary, tone = "primary", className }: { points: BarPoint[]; summary: string; tone?: "primary" | "mint"; className?: string }) {
  const heights = scaleToMax(points.map((p) => p.value));
  const ticks = new Set(axisTickIndexes(points.length));
  const bar = tone === "mint" ? "bg-mint" : "bg-primary";
  return (
    <figure className={cn("flex flex-col", className)}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden className="flex min-h-0 flex-1 items-end gap-[3px] border-b border-border">
        {points.map((p, i) => (
          <div key={p.key} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-[3px] transition-opacity", p.value > 0 ? cn(bar, "opacity-85 group-hover:opacity-100") : "bg-border")}
              style={{ height: p.value > 0 ? `max(${heights[i]}%, 3px)` : "2px" }}
            />
            <div
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1.5 hidden rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white shadow-raised group-hover:block",
                // Columns near either edge anchor their label inward so it never leaves the card.
                i < EDGE_COLUMNS ? "left-0" : i >= points.length - EDGE_COLUMNS ? "right-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              <span className="text-white/65">{p.label}</span> <span className="font-semibold tabular-nums">{p.display}</span>
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-[3px] text-[10px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={p.key} className={cn("flex-1 whitespace-nowrap", i === points.length - 1 ? "text-right" : i === 0 ? "text-left" : "text-center")}>
            {ticks.has(i) ? p.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface RankedRow {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
  detail?: string;
}

/** Ranked horizontal bars: a real list, so every row is read out with its figures. */
export function RankedBars({ rows, label, tone = "primary" }: { rows: RankedRow[]; label: string; tone?: "primary" | "mint" }) {
  const widths = scaleToMax(rows.map((r) => r.value));
  return (
    <ol aria-label={label} className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{r.display}</span>
              {r.detail && <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>}
            </span>
          </div>
          <div aria-hidden className="mt-1.5 ml-6 h-1.5 rounded-full bg-muted">
            <div className={cn("h-full rounded-full", tone === "mint" ? "bg-mint" : "bg-primary")} style={{ width: `${Math.max(widths[i] ?? 0, 2)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
