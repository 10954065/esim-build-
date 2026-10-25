import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Price, type PriceValue } from "./price";

export function ServiceInitial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-primary", className)}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function StockIndicator({ stock }: { stock: number }) {
  const inStock = stock > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        inStock ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", inStock ? "bg-mint" : "bg-muted-foreground/50")} aria-hidden />
      {inStock ? "Available" : "Out of stock"}
    </span>
  );
}

/** One service in a country's verification inventory, laid out as a table row on wide screens. */
export function ServiceRow({
  href,
  name,
  fromPrice,
  totalStock,
}: {
  href: string;
  name: string;
  fromPrice: PriceValue | null;
  totalStock: number;
}) {
  return (
    <Link
      href={href}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none sm:grid-cols-[auto_1fr_140px_120px_auto]"
    >
      <ServiceInitial name={name} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground sm:hidden">
          from <Price value={fromPrice} unavailableLabel="—" className="text-foreground" />
        </span>
      </span>
      <span className="hidden sm:block">
        <StockIndicator stock={totalStock} />
      </span>
      <span className="hidden text-right sm:block">
        <span className="block text-xs text-muted-foreground">from</span>
        <Price value={fromPrice} unavailableLabel="—" className="text-foreground" />
      </span>
      <span className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        Choose <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
