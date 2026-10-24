import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

export interface PriceValue {
  amount: string;
  currency: string;
}

export function Price({
  value,
  suffix,
  className,
  unavailableLabel = "Unavailable",
}: {
  value: PriceValue | null;
  suffix?: string;
  className?: string;
  unavailableLabel?: string;
}) {
  if (!value) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)} title="This item cannot be priced right now">
        {unavailableLabel}
      </span>
    );
  }
  return (
    <span className={cn("font-semibold tabular-nums", className)}>
      {formatMoney(value.amount, value.currency)}
      {suffix && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>}
    </span>
  );
}
