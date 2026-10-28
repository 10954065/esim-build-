import "server-only";
import { syncAll } from "@/server/catalog/sync";
import { db } from "@/server/db";
import { reconcileFulfilment, sweepPreparingEsims, fulfilOrderItem } from "@/server/fulfilment/service";
import { getEnv } from "@/server/env";
import { runRetention } from "@/server/maintenance";
import { expireUnpaidOrders } from "@/server/payments/confirm";
import { refreshExchangeRate } from "@/server/pricing/fx-refresh";
import { ensureSupplierRecord, getSupplierAdapter } from "@/server/providers/supplier";
import { reconcileRefund, submitRefund } from "@/server/refunds/service";
import { processSandboxRefund } from "@/server/sandbox/ops";
import { getSetting } from "@/server/settings";
import { sweepRentals, sweepVerifications } from "@/server/verification/service";
import { enqueue, PermanentJobError, type JobType } from "./queue";

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (typeof v !== "string" || !v) throw new PermanentJobError(`Job payload is missing "${key}"`);
  return v;
}

function num(payload: Record<string, unknown>, key: string, fallback: number): number {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Re-enqueue refunds stuck in REQUESTED (e.g. the submit job died), never resubmits PENDING ones. */
async function sweepRefunds(): Promise<number> {
  const stuck = await db.refund.findMany({
    where: { status: "REQUESTED", submittedAt: null, createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    take: 25,
    select: { id: true },
  });
  return enqueue(db, stuck.map((r) => ({ type: "refund.submit" as const, payload: { refundId: r.id }, dedupeKey: `refund-submit:${r.id}:sweep:${Math.floor(Date.now() / 600000)}` })));
}

async function snapshotSupplierBalance(): Promise<void> {
  const adapter = getSupplierAdapter();
  const supplier = await ensureSupplierRecord(adapter);
  try {
    const { balance } = await adapter.account.getBalance();
    await db.$transaction([
      db.supplierBalanceSnapshot.create({ data: { supplierId: supplier.id, balance, currency: adapter.priceCurrency } }),
      db.supplier.update({ where: { id: supplier.id }, data: { lastHealthAt: new Date(), lastHealthOk: true, lastHealthError: null } }),
    ]);
  } catch (err) {
    await db.supplier.update({
      where: { id: supplier.id },
      data: { lastHealthAt: new Date(), lastHealthOk: false, lastHealthError: err instanceof Error ? err.message.slice(0, 300) : "error" },
    });
    throw err;
  }
}

export const HANDLERS: Record<JobType, Handler> = {
  "fulfil-order-item": (p) => fulfilOrderItem(str(p, "orderItemId")),
  "reconcile-fulfilment": (p) => reconcileFulfilment(str(p, "fulfilmentId"), num(p, "attempt", 1)),
  "refund.submit": (p) => submitRefund(str(p, "refundId")),
  "refund.reconcile": (p) => reconcileRefund(str(p, "refundId"), num(p, "attempt", 1)),
  "sandbox.refund.process": (p) => processSandboxRefund(str(p, "gatewayRefundId")),
  "orders.expire-unpaid": async () => expireUnpaidOrders(await getSetting("orders.paymentWindowMinutes")),
  "verification.sweep": () => sweepVerifications(),
  "esim.sweep": () => sweepPreparingEsims(),
  "refund.sweep": () => sweepRefunds(),
  "rental.sweep": () => sweepRentals(),
  "catalog.sync": () => syncAll({ maxDestinations: 15 }),
  "supplier.balance": () => snapshotSupplierBalance(),
  "fx.refresh": () => {
    const env = getEnv();
    return refreshExchangeRate({ base: env.SUPPLIER_PRICE_CURRENCY, quote: env.PAYMENT_CURRENCY });
  },
  "maintenance.retention": () => runRetention(),
};
