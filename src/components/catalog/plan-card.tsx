import { ArrowRight, CalendarDays, Signal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { formatValidity } from "@/lib/format";
import { Price, type PriceValue } from "./price";

export interface PlanCardData {
  id: string;
  slug: string;
  name: string;
  dataLabel: string | null;
  /** Bytes as a decimal string; used for the price-per-GB hint. */
  dataVolumeBytes?: string | null;
  validityDays: number | null;
  unlimited: boolean;
  pricingUnit: string | null;
  speed: string | null;
  fupPolicy: string | null;
  price: PriceValue | null;
}

const GB = 1024 ** 3;

function perGb(plan: PlanCardData): string | null {
  if (!plan.price || plan.unlimited || plan.pricingUnit === "per_day" || !plan.dataVolumeBytes) return null;
  const gb = Number(plan.dataVolumeBytes) / GB;
  if (!(gb >= 1)) return null;
  return `${formatMoney(Number(plan.price.amount) / gb, plan.price.currency)} / GB`;
}

/** One selectable data bundle, laid out like the design's bundle list. */
export function PlanCard({ plan, destinationSlug }: { plan: PlanCardData; destinationSlug: string }) {
  const perDay = plan.pricingUnit === "per_day";
  const unitPrice = perGb(plan);
  return (
    <article className="group flex flex-col gap-4 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-raised sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold tracking-tight">{plan.dataLabel ?? "Data plan"}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3" aria-hidden />
            {perDay ? "Day pass · 1 to 365 days" : formatValidity(plan.validityDays)}
          </span>
          {plan.speed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              <Signal className="size-3" aria-hidden />
              {plan.speed}
            </span>
          )}
          {plan.unlimited && (
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Unlimited</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{plan.name}</p>
        {plan.fupPolicy && <p className="mt-1 text-xs text-muted-foreground">After allowance: {plan.fupPolicy}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-left sm:text-right">
          <Price value={plan.price} suffix={perDay ? "/day" : undefined} className="text-xl text-foreground" />
          {unitPrice && <p className="text-xs text-muted-foreground tabular-nums">{unitPrice}</p>}
        </div>
        <Button asChild variant={plan.price ? "default" : "secondary"} className="h-10 px-4">
          <Link href={`/esims/${destinationSlug}/${plan.slug}`}>
            View plan <ArrowRight className="hidden sm:block" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
