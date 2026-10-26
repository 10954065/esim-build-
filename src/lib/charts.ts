/** Pure helpers behind the admin charts, kept free of React so they are easy to test. */

/** Each value as a percentage of the largest one (0 to 100). All zero gives all zero. */
export function scaleToMax(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => Math.max(0, (v / max) * 100));
}

/** Indexes worth labelling on a time axis: first, middle and last (deduplicated). */
export function axisTickIndexes(length: number): number[] {
  if (length <= 0) return [];
  return [...new Set([0, Math.floor((length - 1) / 2), length - 1])];
}

const DAY_MS = 86_400_000;

/** Whole UTC days covered by the half open range [from, to). */
export function daysInRange(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

export interface ProfitParts {
  grossSales: string;
  refunds: string;
  supplierCostConverted: string | null;
  gatewayFees: string;
  netContribution: string | null;
}

export interface ProfitSegment {
  key: "refunds" | "supplier" | "fees" | "contribution";
  label: string;
  value: number;
  /** Share of gross sales, 0 to 100. */
  share: number;
}

/**
 * Splits gross sales into refunds, supplier costs, payment fees and what is left.
 * Returns null when the split cannot be drawn honestly: no sales, a missing exchange
 * rate, or costs larger than sales (a negative remainder has no place in a 100% bar).
 */
export function profitBreakdown(p: ProfitParts): ProfitSegment[] | null {
  const gross = Number(p.grossSales);
  if (!(gross > 0) || p.supplierCostConverted === null || p.netContribution === null) return null;
  const contribution = Number(p.netContribution);
  if (contribution < 0) return null;
  const parts: Array<Omit<ProfitSegment, "share">> = [
    { key: "refunds", label: "Refunds", value: Number(p.refunds) },
    { key: "supplier", label: "Supplier costs", value: Number(p.supplierCostConverted) },
    { key: "fees", label: "Payment fees", value: Number(p.gatewayFees) },
    { key: "contribution", label: "Net contribution", value: contribution },
  ];
  return parts.map((s) => ({ ...s, share: (s.value / gross) * 100 }));
}
