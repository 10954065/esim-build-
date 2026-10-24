import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { sp1, type SearchParams } from "@/components/admin/notice";
import { formatMoney } from "@/lib/currency";
import { requireStaff } from "@/server/auth/session";
import { profitReport } from "@/server/admin/reports";

export const metadata = { title: "Profit report" };

function defaultEnd(): Date {
  return new Date(Date.now() + 86400000);
}

function parseDate(v: string | undefined, fallback: Date): Date {
  const d = v ? new Date(`${v}T00:00:00Z`) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default async function AdminAnalytics({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("reports.read");
  const sp = await searchParams;
  const to = parseDate(sp1(sp, "to"), defaultEnd());
  const from = parseDate(sp1(sp, "from"), new Date(to.getTime() - 31 * 86400000));
  const r = await profitReport(from, to);
  const m = (v: string | null) => (v === null ? "Needs exchange rates" : formatMoney(v, r.currency));
  const rate = r.paidOrders ? Math.round((r.fulfilledOrders / r.paidOrders) * 100) : null;

  return (
    <>
      <AdminHeader title="Profit report" description="Computed from captured payments, confirmed refunds, gateway fees and actual supplier charges. Demo (sandbox) orders are excluded from order counts." />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        <label>From <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="h-9 rounded-md border bg-background px-2" /></label>
        <label>To <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="h-9 rounded-md border bg-background px-2" /></label>
        <button className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground">Update</button>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Summary">
          <dl className="space-y-2 text-sm">
            {[
              ["Gross sales", m(r.grossSales)],
              ["Refunds", `−${m(r.refunds)}`],
              ["Net sales", m(r.netSales)],
              [`Supplier costs (${r.supplierCostCurrency} ${r.supplierCost})`, `−${m(r.supplierCostConverted)}`],
              ["Gross profit", m(r.grossProfit)],
              ["Payment processing fees", `−${m(r.gatewayFees)}`],
              ["Estimated net operating contribution", m(r.netContribution)],
            ].map(([k, v], i) => (
              <div key={k} className={i === 4 || i === 6 ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between"}>
                <dt className={i === 4 || i === 6 ? "" : "text-muted-foreground"}>{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Net contribution excludes overheads such as hosting, staff and taxes; it is not net profit.
          </p>
        </Panel>
        <Panel title="Orders">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Paid</dt><dd className="text-xl font-semibold">{r.paidOrders}</dd></div>
            <div><dt className="text-muted-foreground">Fulfilled</dt><dd className="text-xl font-semibold">{r.fulfilledOrders}</dd></div>
            <div><dt className="text-muted-foreground">Failed / refunded</dt><dd className="text-xl font-semibold">{r.failedOrders}</dd></div>
          </dl>
          <p className="mt-3 text-sm">Success rate: {rate === null ? "—" : `${rate}%`}</p>
        </Panel>
        <Panel title="Sales by category">
          <Table head={["Category", "Orders", "Sales"]} empty={r.byCategory.length === 0}>
            {r.byCategory.map((x) => <tr key={x.category}><Td>{x.category}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Sales by country / destination">
          <Table head={["Country", "Orders", "Sales"]} empty={r.byCountry.length === 0}>
            {r.byCountry.map((x) => <tr key={x.country}><Td>{x.country}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Sales by day">
          <Table head={["Day", "Orders", "Sales"]} empty={r.byDay.length === 0}>
            {r.byDay.map((x) => <tr key={x.day}><Td>{x.day}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Sales by month">
          <Table head={["Month", "Orders", "Sales"]} empty={r.byMonth.length === 0}>
            {r.byMonth.map((x) => <tr key={x.month}><Td>{x.month}</Td><Td>{x.orders}</Td><Td className="tabular-nums">{formatMoney(x.sales, r.currency)}</Td></tr>)}
          </Table>
        </Panel>
      </div>
    </>
  );
}
