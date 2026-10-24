import "server-only";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { dec } from "@/server/pricing/money";

/**
 * Profit report built from the append-only ledger (money actually captured/refunded) and
 * fulfilment records (supplier cost actually charged). Never invented: every figure is a
 * sum of stored transactions. Gross profit and net contribution are reported separately.
 */

export interface ProfitReport {
  from: Date;
  to: Date;
  currency: string;
  grossSales: string;
  refunds: string;
  netSales: string;
  supplierCost: string;
  supplierCostCurrency: string;
  supplierCostConverted: string | null;
  grossProfit: string | null;
  gatewayFees: string;
  netContribution: string | null;
  paidOrders: number;
  fulfilledOrders: number;
  failedOrders: number;
  byCategory: Array<{ category: string; orders: number; sales: string }>;
  byCountry: Array<{ country: string; orders: number; sales: string }>;
  byDay: Array<{ day: string; orders: number; sales: string }>;
  byMonth: Array<{ month: string; orders: number; sales: string }>;
}

async function ledgerSum(account: string, direction: "DEBIT" | "CREDIT", from: Date, to: Date, currency?: string): Promise<string> {
  const rows = await db.$queryRaw<Array<{ total: string | null }>>`
    SELECT COALESCE(SUM(amount), 0)::text AS total FROM "LedgerEntry"
    WHERE account = ${account}::"LedgerAccount" AND direction = ${direction}::"LedgerDirection"
      AND "createdAt" >= ${from} AND "createdAt" < ${to}
      AND (${currency ?? null}::text IS NULL OR currency = ${currency ?? null})
  `;
  return rows[0]?.total ?? "0";
}

export async function profitReport(from: Date, to: Date): Promise<ProfitReport> {
  const env = getEnv();
  const currency = env.PAYMENT_CURRENCY;
  const supplierCurrency = env.SUPPLIER_PRICE_CURRENCY;

  const [grossSales, refunds, fees, supplierCostGross, supplierCostReversed] = await Promise.all([
    ledgerSum("SALES_REVENUE", "CREDIT", from, to, currency),
    ledgerSum("CUSTOMER_REFUNDS", "DEBIT", from, to, currency),
    ledgerSum("GATEWAY_FEES", "DEBIT", from, to, currency),
    ledgerSum("SUPPLIER_COST", "DEBIT", from, to, supplierCurrency),
    ledgerSum("SUPPLIER_COST", "CREDIT", from, to, supplierCurrency),
  ]);
  const supplierCost = dec(supplierCostGross).minus(dec(supplierCostReversed));

  // Convert supplier cost with the rates stored on each order (only when currencies differ).
  let supplierCostConverted: string | null = supplierCost.toString();
  if (supplierCurrency !== currency) {
    const rows = await db.$queryRaw<Array<{ converted: string | null; missing: bigint }>>`
      SELECT COALESCE(SUM(f."supplierCost" * o."exchangeRateValue"), 0)::text AS converted,
             COUNT(*) FILTER (WHERE o."exchangeRateValue" IS NULL) AS missing
      FROM "Fulfilment" f JOIN "OrderItem" i ON i.id = f."orderItemId" JOIN "Order" o ON o.id = i."orderId"
      WHERE f.status = 'SUCCEEDED' AND f."completedAt" >= ${from} AND f."completedAt" < ${to}
    `;
    supplierCostConverted = rows[0] && Number(rows[0].missing) === 0 ? (rows[0].converted ?? "0") : null;
  }
  const netSales = dec(grossSales).minus(dec(refunds));
  const grossProfit = supplierCostConverted !== null ? netSales.minus(dec(supplierCostConverted)) : null;
  const netContribution = grossProfit !== null ? grossProfit.minus(dec(fees)) : null;

  const [counts, byCategory, byCountry, byDay, byMonth] = await Promise.all([
    db.$queryRaw<Array<{ paid: bigint; fulfilled: bigint; failed: bigint }>>`
      SELECT COUNT(*) AS paid,
        COUNT(*) FILTER (WHERE status IN ('FULFILLED','PARTIALLY_REFUNDED')) AS fulfilled,
        COUNT(*) FILTER (WHERE status IN ('FAILED','REFUNDED','NEEDS_REVIEW','REFUND_PENDING')) AS failed
      FROM "Order" WHERE "paidAt" >= ${from} AND "paidAt" < ${to} AND "isSandbox" = false
    `,
    db.$queryRaw<Array<{ category: string; orders: bigint; sales: string }>>`
      SELECT i."productType"::text AS category, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(i.total), 0)::text AS sales
      FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to} AND o."isSandbox" = false
      GROUP BY 1 ORDER BY 3 DESC
    `,
    db.$queryRaw<Array<{ country: string; orders: bigint; sales: string }>>`
      SELECT COALESCE(c.name, d.name, 'Unknown') AS country, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(i.total), 0)::text AS sales
      FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id JOIN "Product" p ON p.id = i."productId"
      LEFT JOIN "Country" c ON c.id = p."countryId" LEFT JOIN "EsimDestination" d ON d.id = p."destinationId"
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to} AND o."isSandbox" = false
      GROUP BY 1 ORDER BY 3 DESC LIMIT 15
    `,
    db.$queryRaw<Array<{ day: string; orders: bigint; sales: string }>>`
      SELECT to_char(date_trunc('day', "paidAt"), 'YYYY-MM-DD') AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0)::text AS sales
      FROM "Order" WHERE "paidAt" >= ${from} AND "paidAt" < ${to} AND "isSandbox" = false
      GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<Array<{ month: string; orders: bigint; sales: string }>>`
      SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS month, COUNT(*) AS orders, COALESCE(SUM(total), 0)::text AS sales
      FROM "Order" WHERE "paidAt" >= ${from} AND "paidAt" < ${to} AND "isSandbox" = false
      GROUP BY 1 ORDER BY 1
    `,
  ]);
  const c = counts[0];
  const n = (v: bigint) => Number(v);
  return {
    from,
    to,
    currency,
    grossSales,
    refunds,
    netSales: netSales.toString(),
    supplierCost: supplierCost.toString(),
    supplierCostCurrency: supplierCurrency,
    supplierCostConverted,
    grossProfit: grossProfit?.toString() ?? null,
    gatewayFees: fees,
    netContribution: netContribution?.toString() ?? null,
    paidOrders: c ? n(c.paid) : 0,
    fulfilledOrders: c ? n(c.fulfilled) : 0,
    failedOrders: c ? n(c.failed) : 0,
    byCategory: byCategory.map((r) => ({ category: r.category, orders: n(r.orders), sales: r.sales })),
    byCountry: byCountry.map((r) => ({ country: r.country, orders: n(r.orders), sales: r.sales })),
    byDay: byDay.map((r) => ({ day: r.day, orders: n(r.orders), sales: r.sales })),
    byMonth: byMonth.map((r) => ({ month: r.month, orders: n(r.orders), sales: r.sales })),
  };
}
