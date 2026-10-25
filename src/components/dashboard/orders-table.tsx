import Link from "next/link";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { OrderItemLabel, ProductTypePill, type OrderItemSummary } from "./order-item";

export interface OrderRow {
  id: string;
  number: string;
  status: string;
  total: { toString(): string };
  currency: string;
  createdAt: Date;
  isSandbox: boolean;
  items: OrderItemSummary[];
}

/** Orders table from the design: order id, product with flag, type, date, amount, status, action. */
export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted text-left text-xs tracking-[0.06em] text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Order
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Product
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Type
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Date
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Amount
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id} className="transition-colors hover:bg-accent/40">
              <td className="px-5 py-3.5 font-mono text-xs font-medium whitespace-nowrap">{o.number}</td>
              <td className="max-w-64 px-5 py-3.5">
                <span className="flex items-center gap-2">
                  <OrderItemLabel item={o.items[0]} className="font-medium" />
                  <DemoBadge show={o.isSandbox} />
                </span>
              </td>
              <td className="px-5 py-3.5">
                <ProductTypePill type={o.items[0]?.productType} />
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{formatDate(o.createdAt)}</td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatMoney(o.total.toString(), o.currency)}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link href={`/dashboard/orders/${o.id}`} className="text-sm font-semibold whitespace-nowrap text-primary hover:underline">
                  View details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
