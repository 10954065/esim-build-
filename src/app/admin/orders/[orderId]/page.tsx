import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { linkSupplierOrderAction, retryFulfilmentAction, staffRefundAction } from "@/app/admin/actions";
import { AdminHeader, Panel, ReasonForm, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { getOrderForStaff } from "@/server/admin/queries";
import { isUuid } from "@/server/customer/queries";
import { dec, sum } from "@/server/pricing/money";

export const metadata = { title: "Order" };

export default async function AdminOrderDetail({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: SearchParams }) {
  const user = await requireStaff("orders.read");
  const [{ orderId }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(orderId)) notFound();
  const order = await getOrderForStaff(orderId);
  if (!order) notFound();
  const back = `/admin/orders/${order.id}`;
  const captured = order.payments.find((p) => p.status === "SUCCEEDED");
  const refunded = sum(order.refunds.filter((r) => ["REQUESTED", "PENDING", "COMPLETED"].includes(r.status)).map((r) => r.amount));
  const refundable = captured ? dec(captured.amount).minus(refunded) : dec(0);

  return (
    <>
      <AdminHeader title={`Order ${order.number}`} description={<>Customer {order.user.email} · created {formatDateTime(order.createdAt)} <DemoBadge show={order.isSandbox} /></>} actions={<StatusBadge status={order.status} className="text-sm" />} />
      <ActionNotice sp={sp} />
      {order.statusReason && <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">Last status reason: {order.statusReason}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Items & fulfilment">
          <div className="space-y-4">
            {order.items.map((item) => {
              const f = item.fulfilment;
              return (
                <div key={item.id} className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">Product code {item.product.supplierProductCode} · supplier cost {item.wholesaleCost.toString()} {item.wholesaleCurrency}</p>
                  {f ? (
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div><dt className="text-muted-foreground">Fulfilment</dt><dd><StatusBadge status={f.status} /></dd></div>
                      <div><dt className="text-muted-foreground">Attempts</dt><dd>{f.attempts}</dd></div>
                      <div><dt className="text-muted-foreground">Supplier ref</dt><dd className="font-mono">{f.supplierOrderRef ?? "None"}</dd></div>
                      <div><dt className="text-muted-foreground">Supplier error</dt><dd>{f.lastError ?? "None"}</dd></div>
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not started (order not paid).</p>
                  )}
                  {f && ["NEEDS_REVIEW", "FAILED"].includes(f.status) && can(user.role, "orders.manage") && (
                    <ReasonForm action={retryFulfilmentAction} hidden={{ fulfilmentId: f.id, back }} label="Retry with supplier" />
                  )}
                  {f && ["NEEDS_REVIEW", "UNCERTAIN"].includes(f.status) && can(user.role, "orders.manual_fulfil") && (
                    <form action={linkSupplierOrderAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="fulfilmentId" value={f.id} />
                      <input type="hidden" name="back" value={back} />
                      <input name="supplierRef" required placeholder="Verified supplier order ID" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
                      <input name="reason" required minLength={5} placeholder="Reason (audited)" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
                      <button type="submit" className="h-8 rounded-md border px-3 text-sm">Link & verify with supplier</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Payment & refunds">
          <div className="space-y-3 text-sm">
            {order.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-mono text-xs">{p.reference}</p>
                  <p className="text-xs text-muted-foreground">{p.provider} · gateway txn {p.gatewayTransactionId ?? "none"} · {p.channel ?? ""}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{formatMoney(p.amount.toString(), p.currency)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
            {order.refunds.map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p>{r.reason}</p>
                  <p className="text-xs text-muted-foreground">{r.initiatedByType} · {formatDateTime(r.createdAt)} {r.failureReason ? `· ${r.failureReason}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">−{formatMoney(r.amount.toString(), r.currency)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
            {captured && refundable.gt(0) && can(user.role, "refunds.manage") && (
              <form action={staffRefundAction} className="space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground">Refundable: {formatMoney(refundable.toString(), captured.currency)}. Leave amount empty for a full refund.</p>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="nonce" value={randomUUID()} />
                <input type="hidden" name="back" value={back} />
                <div className="flex flex-wrap gap-2">
                  <input name="amount" inputMode="decimal" placeholder="Amount (optional)" className="h-8 w-36 rounded-md border bg-background px-2 text-sm" />
                  <input name="reason" required minLength={5} maxLength={300} placeholder="Reason (audited)" className="h-8 w-64 rounded-md border bg-background px-2 text-sm" />
                  <button type="submit" className="h-8 rounded-md bg-destructive/10 px-3 text-sm font-medium text-destructive">Issue refund</button>
                </div>
              </form>
            )}
          </div>
        </Panel>

        <Panel title="Status history">
          <ol className="space-y-2 text-sm">
            {order.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span><strong>{h.toStatus}</strong> {h.reason ? `: ${h.reason}` : ""} <span className="text-xs text-muted-foreground">({h.actorType})</span></span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Ledger entries">
          <Table head={["Journal", "Account", "Dr/Cr", "Amount"]} empty={order.ledgerEntries.length === 0}>
            {order.ledgerEntries.map((l) => (
              <tr key={l.id}>
                <Td mono>{l.journalRef.split(":")[0]}</Td>
                <Td>{l.account}</Td>
                <Td>{l.direction}</Td>
                <Td className="tabular-nums">{l.amount.toString()} {l.currency}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
