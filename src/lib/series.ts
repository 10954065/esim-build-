export interface DailyRow {
  day: string; // YYYY-MM-DD (UTC)
  orders: number;
  sales: string;
}

export interface DailyPoint {
  day: string;
  orders: number;
  sales: number;
}

const DAY_MS = 86_400_000;

/** One point per UTC day ending on `end`'s day, oldest first; days without rows are zero. */
export function fillDailySeries(rows: DailyRow[], end: Date, days: number): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(last - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    const row = byDay.get(day);
    return { day, orders: row?.orders ?? 0, sales: row ? Number(row.sales) : 0 };
  });
}
