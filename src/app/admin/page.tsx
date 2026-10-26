import { AlertTriangle, ArrowUpRight, Cable, Mail, PackageSearch, Server, Workflow } from "lucide-react";
import Link from "next/link";
import { AdminHeader, Panel } from "@/components/admin/admin-ui";
import { Sparkline } from "@/components/admin/sparkline";
import { formatMoney } from "@/lib/currency";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/session";
import { adminOverview } from "@/server/admin/queries";
import { adminTrends } from "@/server/admin/reports";

export const metadata = { title: "Overview" };

type Health = "ok" | "warn" | "fail";

const HEALTH_DOT: Record<Health, string> = { ok: "bg-mint", warn: "bg-[#f59e0b]", fail: "bg-destructive" };
const TREND_DAYS = 14;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function AdminHome() {
  await requireStaff();
  const [o, t] = await Promise.all([adminOverview(), adminTrends(TREND_DAYS)]);
  const balance = o.supplier?.balances[0];
  const today = t.series.at(-1);

  const health: Array<{ icon: typeof Server; label: string; value: string; state: Health; href: string }> = [
    {
      icon: Server,
      label: o.supplier ? o.supplier.name : "Supplier",
      value: !o.supplier ? "Not synced" : o.supplier.lastHealthOk === null ? "Not checked yet" : o.supplier.lastHealthOk ? "Healthy" : "Failing",
      state: !o.supplier || o.supplier.lastHealthOk === null ? "warn" : o.supplier.lastHealthOk ? "ok" : "fail",
      href: "/admin/suppliers",
    },
    { icon: Workflow, label: "Background jobs (7 days)", value: o.failedJobs ? plural(o.failedJobs, "dead job") : "All clear", state: o.failedJobs ? "fail" : "ok", href: "/admin/integrations" },
    { icon: Cable, label: "Webhooks (24 hours)", value: o.failedWebhooks ? plural(o.failedWebhooks, "failure") : "All clear", state: o.failedWebhooks ? "fail" : "ok", href: "/admin/integrations" },
    { icon: Mail, label: "Emails (24 hours)", value: o.failedEmails ? plural(o.failedEmails, "failure") : "All clear", state: o.failedEmails ? "warn" : "ok", href: "/admin/integrations" },
  ];

  const attention = [
    { label: "Orders needing review", value: o.review, href: "/admin/orders?status=NEEDS_REVIEW", urgent: o.review > 0 },
    { label: "Uncertain fulfilments", value: o.uncertain, href: "/admin/orders?status=FULFILLING", urgent: o.uncertain > 0 },
    { label: "Refunds in progress", value: o.pendingRefunds, href: "/admin/refunds?status=PENDING", urgent: false },
    { label: "Open support tickets", value: o.openTickets, href: "/admin/support", urgent: false },
  ];
  const urgentTotal = attention.reduce((n, a) => n + (a.urgent ? a.value : 0), 0);

  return (
    <>
      <AdminHeader title="Operations overview" description="Live state of orders, money and integrations. Every figure comes from stored records." />

      <ul aria-label="System health" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {health.map((h) => (
          <li key={h.label}>
            <Link href={h.href} className="surface-interactive flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                <h.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-muted-foreground">{h.label}</span>
                <span className="flex items-center gap-2 font-semibold">
                  <span className={cn("size-2 rounded-full", HEALTH_DOT[h.state], h.state === "ok" && "animate-pulse-dot")} aria-hidden />
                  {h.value}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_minmax(18rem,0.9fr)]">
        <section aria-labelledby="kpi-orders" className="surface flex flex-col overflow-hidden">
          <div className="p-5 pb-2">
            <h2 id="kpi-orders" className="font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Paid orders · last {TREND_DAYS} days
            </h2>
            <p className="mt-2 font-heading text-4xl font-bold tabular-nums">{t.totalOrders}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Today <span className="font-semibold text-foreground tabular-nums">{today?.orders ?? 0}</span> · 24 hours{" "}
              <span className="font-semibold text-foreground tabular-nums">{o.todayOrders}</span>
            </p>
          </div>
          <Sparkline values={t.series.map((p) => p.orders)} className="mt-auto h-20 pt-4" />
        </section>

        <section aria-labelledby="kpi-sales" className="surface flex flex-col overflow-hidden">
          <div className="p-5 pb-2">
            <h2 id="kpi-sales" className="font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Sales · last {TREND_DAYS} days
            </h2>
            <p className="mt-2 font-heading text-4xl font-bold tabular-nums">{formatMoney(t.totalSales.toFixed(2), t.currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Today <span className="font-semibold text-foreground tabular-nums">{formatMoney((today?.sales ?? 0).toFixed(2), t.currency)}</span>
              {t.includesDemo && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Includes demo orders</span>}
            </p>
          </div>
          <Sparkline values={t.series.map((p) => p.sales)} className="mt-auto h-20 pt-4 text-mint" />
        </section>

        <section aria-labelledby="attention" className="relative isolate overflow-hidden rounded-2xl bg-ink p-5 text-ink-foreground shadow-raised">
          <div aria-hidden className="grid-lines absolute inset-0 -z-10 opacity-60" />
          <div className="flex items-center justify-between gap-3">
            <h2 id="attention" className="flex items-center gap-2 font-sans text-xs font-semibold tracking-[0.08em] text-white/60 uppercase">
              <AlertTriangle className="size-3.5" aria-hidden /> Needs attention
            </h2>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold text-ink", urgentTotal ? "bg-[#fbbf24]" : "bg-mint")}>
              {urgentTotal ? `${urgentTotal} urgent` : "All clear"}
            </span>
          </div>
          <ul className="mt-4 divide-y divide-white/10">
            {attention.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="group flex items-center justify-between gap-3 py-2.5 text-sm outline-none focus-visible:underline">
                  <span className="text-white/85 group-hover:text-white">{a.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("font-mono text-base font-semibold tabular-nums", a.urgent ? "text-[#fbbf24]" : "text-white")}>{a.value}</span>
                    <ArrowUpRight className="size-3.5 text-white/60 group-hover:text-white" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Supplier"
          actions={
            <Link href="/admin/suppliers" className="text-sm font-medium text-primary hover:underline">
              Details
            </Link>
          }
        >
          {o.supplier ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Supplier</dt>
                <dd className="font-medium">
                  {o.supplier.name} ({o.supplier.mode})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Health</dt>
                <dd className="font-medium">
                  {o.supplier.lastHealthOk === null ? "Not checked yet" : o.supplier.lastHealthOk ? "OK" : `Failing: ${o.supplier.lastHealthError ?? ""}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prepaid balance</dt>
                <dd className="font-heading text-xl font-semibold tabular-nums">{balance ? formatMoney(balance.balance.toString(), balance.currency) : "Not checked"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Checked</dt>
                <dd className="font-medium">{formatRelative(o.supplier.lastHealthAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No supplier has synced yet.</p>
          )}
        </Panel>
        <Panel title="Runbook" actions={<PackageSearch className="size-4 text-muted-foreground" aria-hidden />}>
          <ol className="space-y-3 text-sm">
            {[
              "Orders under review: open the order, check the supplier error, then retry, link a verified supplier order, or refund.",
              "Insufficient supplier balance: top up with the supplier, then retry the affected orders.",
              "Dead jobs and failed webhooks are listed under Integrations.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-muted-foreground">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
