import { syncCatalogAction } from "@/app/admin/actions";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";

export const metadata = { title: "Suppliers" };

export default async function AdminSuppliers({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("catalog.read");
  const sp = await searchParams;
  const env = getEnv();
  const [suppliers, logs] = await Promise.all([
    db.supplier.findMany({ include: { balances: { orderBy: { capturedAt: "desc" }, take: 5 }, _count: { select: { products: true } } } }),
    db.catalogSyncLog.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <AdminHeader
        title="Suppliers"
        description={`Active mode: ${env.SUPPLIER_MODE}. Credentials are configured as server environment variables and are never displayed.`}
        actions={
          can(staff.role, "catalog.manage") ? (
            <form action={syncCatalogAction}>
              <input type="hidden" name="back" value="/admin/suppliers" />
              <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Sync catalogue & balance now</button>
            </form>
          ) : undefined
        }
      />
      <ActionNotice sp={sp} />
      <div className="space-y-6">
        {suppliers.map((s) => (
          <Panel key={s.id} title={`${s.name} · ${s.mode}`}>
            <dl className="grid gap-3 text-sm md:grid-cols-4">
              <div><dt className="text-muted-foreground">API key</dt><dd className="font-mono">{s.mode === "LIVE" ? (env.SMS1001_API_KEY ? "configured ••••" : "missing") : "not required"}</dd></div>
              <div><dt className="text-muted-foreground">Webhook secret</dt><dd className="font-mono">{s.mode === "LIVE" ? (env.SMS1001_WEBHOOK_SECRET ? "configured ••••" : "missing") : "sandbox secret"}</dd></div>
              <div><dt className="text-muted-foreground">Health</dt><dd>{s.lastHealthOk === null ? "Not checked" : s.lastHealthOk ? "OK" : `Failing — ${s.lastHealthError}`} ({formatDateTime(s.lastHealthAt)})</dd></div>
              <div><dt className="text-muted-foreground">Products</dt><dd>{s._count.products}</dd></div>
            </dl>
            <p className="mt-3 text-sm">
              Balance history:{" "}
              {s.balances.length ? s.balances.map((b) => `${formatMoney(b.balance.toString(), b.currency)} (${formatDateTime(b.capturedAt)})`).join(" · ") : "none yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Supplier balance is our prepaid account with the supplier — never customer money.</p>
          </Panel>
        ))}
        <Panel title="Recent catalogue syncs">
          <Table head={["Kind", "Scope", "Status", "Upserted", "Deactivated", "Started", "Error"]} empty={logs.length === 0}>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td>{l.kind}</Td>
                <Td mono>{l.scope ?? "—"}</Td>
                <Td>{l.status}</Td>
                <Td>{l.itemsUpserted}</Td>
                <Td>{l.itemsDeactivated}</Td>
                <Td className="text-muted-foreground">{formatDateTime(l.startedAt)}</Td>
                <Td className="max-w-xs truncate text-destructive">{l.error ?? ""}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
