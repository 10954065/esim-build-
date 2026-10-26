import { retryDeadJobAction } from "@/app/admin/actions";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { formatDateTime, humanizeKey } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { integrationsStatus } from "@/server/admin/queries";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";

export const metadata = { title: "Integrations" };

const mask = (v: string | undefined) => (v ? "configured ••••" : "not set");

export default async function AdminIntegrations({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("integrations.read");
  const sp = await searchParams;
  const env = getEnv();
  const [status, deadJobs, failedWebhooks, failedEmails] = await Promise.all([
    integrationsStatus(),
    db.job.findMany({ where: { status: "DEAD" }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.webhookEvent.findMany({ where: { status: "FAILED" }, orderBy: { receivedAt: "desc" }, take: 20 }),
    db.emailDelivery.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, template: true, lastError: true, createdAt: true } }),
  ]);
  const config: Array<[string, string]> = [
    ["App environment", env.APP_ENV],
    ["Supplier mode", env.SUPPLIER_MODE],
    ["1001SMS API key", mask(env.SMS1001_API_KEY)],
    ["1001SMS webhook secret", mask(env.SMS1001_WEBHOOK_SECRET)],
    ["Supplier price currency", env.SUPPLIER_PRICE_CURRENCY],
    ["Payment provider", env.PAYMENT_PROVIDER],
    ["Paystack secret key", mask(env.PAYSTACK_SECRET_KEY)],
    ["Checkout currency", env.PAYMENT_CURRENCY],
    ["Email provider", env.EMAIL_PROVIDER],
    ["Resend API key", mask(env.RESEND_API_KEY)],
    ["Cron secret", mask(env.CRON_SECRET)],
    ["Webhook URLs", `${env.APP_URL}/api/webhooks/payments/paystack · ${env.APP_URL}/api/webhooks/supplier/1001sms`],
  ];
  return (
    <>
      <AdminHeader title="Integrations" description="Configuration status (secrets masked), webhook processing, background jobs and email delivery." />
      <ActionNotice sp={sp} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Configuration">
          <dl className="space-y-1.5 text-sm">
            {config.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-mono text-xs">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Webhooks (7 days)">
          <Table head={["Source", "Status", "Count"]} empty={status.webhookStats.length === 0}>
            {status.webhookStats.map((w) => <tr key={`${w.source}${w.status}`}><Td>{w.source}</Td><Td>{w.status}</Td><Td>{w._count}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Jobs (24 hours)">
          <Table head={["Type", "Status", "Count"]} empty={status.jobStats.length === 0}>
            {status.jobStats.map((j) => <tr key={`${j.type}${j.status}`}><Td>{humanizeKey(j.type)}</Td><Td>{j.status}</Td><Td>{j._count}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Email delivery (7 days)">
          <Table head={["Status", "Count"]} empty={status.emailStats.length === 0}>
            {status.emailStats.map((e) => <tr key={e.status}><Td>{e.status}</Td><Td>{e._count}</Td></tr>)}
          </Table>
        </Panel>
        <Panel title="Dead jobs">
          <Table head={["Type", "Error", "When", ""]} empty={deadJobs.length === 0}>
            {deadJobs.map((j) => (
              <tr key={j.id}>
                <Td>{humanizeKey(j.type)}</Td>
                <Td className="max-w-xs truncate text-destructive">{j.lastError}</Td>
                <Td className="text-muted-foreground">{formatDateTime(j.updatedAt)}</Td>
                <Td>
                  {can(staff.role, "settings.manage") && (
                    <form action={retryDeadJobAction}>
                      <input type="hidden" name="jobId" value={j.id} />
                      <input type="hidden" name="back" value="/admin/integrations" />
                      <button className="h-7 rounded border px-2 text-xs">Retry</button>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Failed webhooks & emails">
          <Table head={["Kind", "Detail", "Error", "When"]} empty={failedWebhooks.length + failedEmails.length === 0}>
            {failedWebhooks.map((w) => <tr key={w.id}><Td>Webhook</Td><Td mono>{w.source} {w.eventType}</Td><Td className="max-w-xs truncate text-destructive">{w.error}</Td><Td className="text-muted-foreground">{formatDateTime(w.receivedAt)}</Td></tr>)}
            {failedEmails.map((e) => <tr key={e.id}><Td>Email</Td><Td mono>{e.template}</Td><Td className="max-w-xs truncate text-destructive">{e.lastError}</Td><Td className="text-muted-foreground">{formatDateTime(e.createdAt)}</Td></tr>)}
          </Table>
        </Panel>
      </div>
    </>
  );
}
