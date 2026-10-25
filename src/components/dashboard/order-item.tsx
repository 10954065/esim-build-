import { Flag } from "@/components/common/flag";
import { cn } from "@/lib/utils";

type DestinationKind = "COUNTRY" | "REGION" | "GLOBAL";

export interface OrderItemSummary {
  description: string;
  productType: "ESIM" | "VERIFICATION" | "RENTAL";
  product: {
    country: { code: string } | null;
    destination: { kind: DestinationKind; country: { code: string } | null } | null;
  };
}

const TYPE_LABEL = { ESIM: "eSIM", VERIFICATION: "SMS", RENTAL: "Rental" } as const;

/** Flag + description for an order line (regional/global eSIMs show a globe). */
export function OrderItemLabel({ item, className }: { item: OrderItemSummary | undefined; className?: string }) {
  if (!item) return <span className={className}>Order</span>;
  const dest = item.product.destination;
  const code = dest ? (dest.country?.code ?? null) : (item.product.country?.code ?? null);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Flag code={code} kind={dest?.kind ?? "COUNTRY"} />
      <span className="truncate">{item.description}</span>
    </span>
  );
}

export function ProductTypePill({ type }: { type: OrderItemSummary["productType"] | undefined }) {
  if (!type) return null;
  return <span className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{TYPE_LABEL[type]}</span>;
}
