import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Price, type PriceValue } from "./price";

export function ServiceInitial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground", className)}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function StockIndicator({ stock }: { stock: number }) {
  const inStock = stock > 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", inStock ? "text-success" : "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", inStock ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
      {inStock ? "Available" : "Out of stock"}
    </span>
  );
}

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
      className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ServiceInitial name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <StockIndicator stock={totalStock} />
      </span>
      <span className="text-right text-sm">
        <span className="block text-xs text-muted-foreground">from</span>
        <Price value={fromPrice} unavailableLabel="—" />
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
