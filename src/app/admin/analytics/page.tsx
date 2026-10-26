import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { BarChart, RankedBars, type BarPoint } from "@/components/admin/bar-chart";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { Flag } from "@/components/common/flag";
import { daysInRange, profitBreakdown, type ProfitSegment } from "@/lib/charts";
import { formatMoney } from "@/lib/currency";
import { formatDayKey, formatMonthKey } from "@/lib/format";
import { fillDailySeries } from "@/lib/series";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/session";
import { profitReport, type ProfitReport } from "@/server/admin/reports";

export const metadata = { title: "Profit report" };

/** Longer ranges are charted per month only; a column per day stops being readable. */
const MAX_DAILY_COLUMNS = 120;
const CATEGORY_LABEL: Record<string, string> = { ESIM: "Travel eSIMs", VERIFICATION: "Verification numbers", RENTAL: "Number rentals" };
const SEGMENT_STYLE: Record<ProfitSegment["key"], string> = {
  refunds: "bg-destructive",
  supplier: "bg-foreground",
  fees: "bg-[#f59e0b]",
  contribution: "bg-mint",
};

function defaultEnd(): Date {
  return new Date(Date.now() + 86400000);
}

function parseDate(v: string | undefined, fallback: Date): Date {
  const d = v ? new Date(`${v}T00:00:00Z`) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function dailyPoints(r: ProfitReport): BarPoint[] | null {
  const days = daysInRange(r.from, r.to);
  if (days === 0 || days > MAX_DAILY_COLUMNS) return null;
  return fillDailySeries(r.byDay, new Date(r.to.getTime() - 1), days).map((p) => ({
    key: p.day,
    label: formatDayKey(p.day, { short: true }),
    value: p.sales,
    display: `${formatMoney(p.sales.toFixed(2), r.currency)} · ${plural(p.orders, "order")}`,
  }));
}

export default async function AdminAnalytics({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("reports.read");
  const sp = await searchParams;
  const to = parseDate(sp1(sp, "to"), defaultEnd());
  const from = parseDate(sp1(sp, "from"), new Date(to.getTime() - 31 * 86400000));
  const r = await profitReport(from, to);
  const m = (v: string | null) => (v === null ? "Needs exchange rates" : formatMoney(v, r.currency));
  const rate = r.paidOrders ? Math.round((r.fulfilledOrders / r.paidOrders) * 100) : null;
  const daily = dailyPoints(r);
  const busiest = daily?.reduce((a, b) => (b.value > a.value ? b : a));
  const breakdown = profitBreakdown(r);
  const monthly: BarPoint[] = r.byMonth.map((x) => ({
    key: x.month,
    label: formatMonthKey(x.month, { short: true }),
    value: Number(x.sales),
    display: `${formatMoney(x.sales, r.currency)} · ${plural(x.orders, "order")}`,
  }));
  const inputClass = "h-9 rounded-lg border bg-card px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  const kpis = [
    { label: "Net sales", value: m(r.netSales), hint: `${m(r.grossSales)} gross, ${m(r.refunds)} refunded` },
    { label: "Gross profit", value: m(r.grossProfit), hint: "Net sales less supplier costs" },
    { label: "Net contribution", value: m(r.netContribution), hint: "After payment fees, before overheads", accent: true },
    { label: "Fulfilment rate", value: rate === null ? "No orders" : `${rate}%`, hint: `${r.fulfilledOrders} of ${plural(r.paidOrders, "paid order")}, ${r.failedOrders} failed or refunded` },
  ];

  return (
    <>
      <AdminHeader
        title="Profit report"
        description="Computed from captured payments, confirmed refunds, gateway fees and actual supplier charges. Demo (sandbox) orders are excluded from order counts."
        actions={
          <form method="get" className="flex flex-wrap items-end gap-2 text-xs font-medium text-muted-foreground">
            <label className="flex flex-col gap-1">
              From <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              To <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className={inputClass} />
            </label>
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Update</button>
          </form>
        }
      />

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-2xl p-5", k.accent ? "bg-ink text-ink-foreground shadow-raised" : "surface")}>
            <dt className={cn("text-xs font-semibold tracking-[0.06em] uppercase", k.accent ? "text-white/60" : "text-muted-foreground")}>{k.label}</dt>
            <dd className="mt-2 font-heading text-3xl font-bold tabular-nums">{k.value}</dd>
            <dd className={cn("mt-1 text-xs", k.accent ? "text-white/70" : "text-muted-foreground")}>{k.hint}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="sales-trend" className="surface mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="sales-trend" className="font-semibold">
              Sales {daily ? "per day" : "per month"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {formatDayKey(r.from.toISOString().slice(0, 10))} to {formatDayKey(new Date(r.to.getTime() - 1).toISOString().slice(0, 10))} (UTC). Hover a column for its figures.
            </p>
          </div>
          {busiest && busiest.value > 0 && (
            <p className="text-sm text-muted-foreground">
              Best day <span className="font-semibold text-foreground">{busiest.label}</span> · {busiest.display}
            </p>
          )}
        </div>
        {r.paidOrders === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No paid orders in this period.</p>
        ) : (
          <BarChart
            points={daily ?? monthly}
            summary={`Sales ${daily ? "per day" : "per month"}. The exact figures are in the tables at the end of this page.`}
            className="mt-6 h-56"
          />
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Where the money goes">
          {breakdown ? (
            <div aria-hidden className="mb-5 flex h-4 overflow-hidden rounded-full bg-muted">
              {breakdown.map((s) => (
                <div key={s.key} className={SEGMENT_STYLE[s.key]} style={{ width: `${s.share}%` }} />
              ))}
            </div>
          ) : (
            <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {Number(r.grossSales) > 0 ? "The split is drawn once supplier costs can be converted and contribution is not negative." : "No sales in this period."}
            </p>
          )}
          <dl className="space-y-2 text-sm">
            {[
              { k: "Gross sales", v: m(r.grossSales) },
              { k: "Refunds", v: `−${m(r.refunds)}`, seg: "refunds" as const },
              { k: "Net sales", v: m(r.netSales), total: true },
              { k: `Supplier costs (${r.supplierCostCurrency} ${r.supplierCost})`, v: `−${m(r.supplierCostConverted)}`, seg: "supplier" as const },
              { k: "Gross profit", v: m(r.grossProfit), total: true },
              { k: "Payment processing fees", v: `−${m(r.gatewayFees)}`, seg: "fees" as const },
              { k: "Estimated net operating contribution", v: m(r.netContribution), total: true, seg: "contribution" as const },
            ].map((row) => {
              const share = breakdown?.find((s) => s.key === row.seg)?.share;
              return (
                <div key={row.k} className={cn("flex items-center justify-between gap-3", row.total && "border-t pt-2 font-semibold")}>
                  <dt className={cn("flex items-center gap-2", !row.total && "text-muted-foreground")}>
                    {row.seg && <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", SEGMENT_STYLE[row.seg])} />}
                    {row.k}
                  </dt>
                  <dd className="text-right whitespace-nowrap tabular-nums">
                    {row.v}
                    {share !== undefined && <span className="ml-2 text-xs font-normal text-muted-foreground">{Math.round(share)}%</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Net contribution excludes overheads such as hosting, staff and taxes; it is not net profit.</p>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Top destinations">
            {r.byCountry.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <RankedBars
                label="Sales by destination"
                rows={r.byCountry.slice(0, 6).map((x) => ({
                  key: x.country,
                  label: (
                    <>
                      <Flag code={x.code} kind={x.kind} /> <span className="truncate">{x.country}</span>
                    </>
                  ),
                  value: Number(x.sales),
                  display: formatMoney(x.sales, r.currency),
                  detail: plural(x.orders, "order"),
                }))}
              />
            )}
          </Panel>
          <Panel title="Sales by product">
            {r.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <RankedBars
                label="Sales by product"
                tone="mint"
                rows={r.byCategory.map((x) => ({
                  key: x.category,
                  label: CATEGORY_LABEL[x.category] ?? x.category,
                  value: Number(x.sales),
                  display: formatMoney(x.sales, r.currency),
                  detail: plural(x.orders, "order"),
                }))}
              />
            )}
          </Panel>
        </div>
      </div>

      {daily && monthly.length > 1 && (
        <section aria-labelledby="sales-months" className="surface mt-6 p-5">
          <h2 id="sales-months" className="font-semibold">
            Sales per month
          </h2>
          <BarChart points={monthly} tone="mint" summary="Sales per month. The exact figures are in the monthly table below." className="mt-6 h-40" />
        </section>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-primary hover:underline">Show daily, monthly and destination tables</summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Panel title="Sales by day">
            <Table label="Sales by day" head={["Day", "Orders", "Sales"]} empty={r.byDay.length === 0}>
              {r.byDay.map((x) => <tr key={x.day}><Td>{formatDayKey(x.day)}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
            </Table>
          </Panel>
          <Panel title="Sales by month">
            <Table label="Sales by month" head={["Month", "Orders", "Sales"]} empty={r.byMonth.length === 0}>
              {r.byMonth.map((x) => <tr key={x.month}><Td>{formatMonthKey(x.month)}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
            </Table>
          </Panel>
          <Panel title="Sales by country or destination">
            <Table label="Sales by destination table" head={["Destination", "Orders", "Sales"]} empty={r.byCountry.length === 0}>
              {r.byCountry.map((x) => <tr key={x.country}><Td>{x.country}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
            </Table>
          </Panel>
        </div>
      </details>
    </>
  );
}
