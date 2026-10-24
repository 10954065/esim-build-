import { CalendarDays, Gauge } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatValidity } from "@/lib/format";
import { Price, type PriceValue } from "./price";

export interface PlanCardData {
  id: string;
  slug: string;
  name: string;
  dataLabel: string | null;
  validityDays: number | null;
  unlimited: boolean;
  pricingUnit: string | null;
  speed: string | null;
  fupPolicy: string | null;
  price: PriceValue | null;
}

export function PlanCard({ plan, destinationSlug }: { plan: PlanCardData; destinationSlug: string }) {
  const perDay = plan.pricingUnit === "per_day";
  return (
    <article className="flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{plan.dataLabel ?? "Data plan"}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{plan.name}</p>
        </div>
        {perDay && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Day pass</span>}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Validity</dt>
          <dd>{perDay ? "Choose 1–365 days" : formatValidity(plan.validityDays)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Network</dt>
          <dd>{plan.speed ?? "—"}</dd>
        </div>
      </dl>
      {plan.fupPolicy && <p className="mt-3 text-xs text-muted-foreground">After allowance: {plan.fupPolicy}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <Price value={plan.price} suffix={perDay ? "/day" : undefined} className="text-xl" />
        <Button asChild variant={plan.price ? "default" : "secondary"} size="sm">
          <Link href={`/esims/${destinationSlug}/${plan.slug}`}>View plan</Link>
        </Button>
      </div>
    </article>
  );
}
