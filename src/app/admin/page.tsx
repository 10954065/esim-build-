import Link from "next/link";
import { AdminHeader, Panel, Stat } from "@/components/admin/admin-ui";
import { formatMoney } from "@/lib/currency";
import { formatRelative } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";
import { adminOverview } from "@/server/admin/queries";

export const metadata = { title: "Overview" };

export default async function AdminHome() {
  await requireStaff();
  const o = await adminOverview();
  const balance = o.supplier?.balances[0];
  return (
    <>
      <AdminHeader title="Operations overview" description="Items that need attention are highlighted." />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders needing review" value={o.review} href="/admin/orders?status=NEEDS_REVIEW" tone={o.review ? "warning" : "neutral"} />
        <Stat label="Uncertain fulfilments" value={o.uncertain} href="/admin/orders?status=FULFILLING" tone={o.uncertain ? "warning" : "neutral"} />
        <Stat label="Refunds in progress" value={o.pendingRefunds} href="/admin/refunds?status=PENDING" />
        <Stat label="Open support tickets" value={o.openTickets} href="/admin/support" />
        <Stat label="Paid orders (24h)" value={o.todayOrders} href="/admin/orders" />
        <Stat label="Dead jobs (7d)" value={o.failedJobs} href="/admin/integrations" tone={o.failedJobs ? "danger" : "neutral"} />
        <Stat label="Failed webhooks (24h)" value={o.failedWebhooks} href="/admin/integrations" tone={o.failedWebhooks ? "danger" : "neutral"} />
        <Stat label="Failed emails (24h)" value={o.failedEmails} href="/admin/integrations" tone={o.failedEmails ? "warning" : "neutral"} />
      </dl>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Supplier" actions={<Link href="/admin/suppliers" className="text-sm underline">Details</Link>}>
          {o.supplier ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Supplier</dt><dd>{o.supplier.name} ({o.supplier.mode})</dd></div>
              <div><dt className="text-muted-foreground">Health</dt><dd>{o.supplier.lastHealthOk === null ? "Not checked yet" : o.supplier.lastHealthOk ? "OK" : `Failing: ${o.supplier.lastHealthError ?? ""}`}</dd></div>
              <div><dt className="text-muted-foreground">Prepaid balance</dt><dd>{balance ? formatMoney(balance.balance.toString(), balance.currency) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Checked</dt><dd>{formatRelative(o.supplier.lastHealthAt)}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No supplier has synced yet.</p>
          )}
        </Panel>
        <Panel title="Runbook">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Orders under review: open the order, check the supplier error, then retry, link a verified supplier order, or refund.</li>
            <li>Insufficient supplier balance: top up with the supplier, then retry the affected orders.</li>
            <li>Dead jobs and failed webhooks are listed under Integrations.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
