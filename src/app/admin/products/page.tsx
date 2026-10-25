import { toggleProductAction } from "@/app/admin/actions";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, sp1, type SearchParams } from "@/components/admin/notice";
import { formatRelative } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { listProducts, pages } from "@/server/admin/queries";
import { createPricingSession } from "@/server/pricing/service";
import { formatMoney } from "@/lib/currency";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("catalog.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const type = sp1(sp, "type");
  const page = Number(sp1(sp, "page") ?? 1);
  const [data, session] = await Promise.all([listProducts({ q, page, type }), createPricingSession()]);
  const manage = can(staff.role, "catalog.manage");
  return (
    <>
      <AdminHeader title="Products" description="Synced from the supplier. Hiding a product removes it from the storefront; supplier availability is shown separately." />
      <ActionNotice sp={sp} />
      <Filters
        action="/admin/products"
        q={q}
        extra={
          <select name="type" aria-label="Product type" defaultValue={type ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">All types</option>
            <option value="ESIM">eSIM</option>
            <option value="VERIFICATION">Verification</option>
            <option value="RENTAL">Rental</option>
          </select>
        }
      />
      <Table head={["Type", "Name", "Supplier code", "Cost", "Customer price", "Margin", "Supplier", "Visible", "Synced"]} empty={data.items.length === 0}>
        {data.items.map((p) => {
          const price = session.tryPrice(p);
          return (
            <tr key={p.id}>
              <Td>{p.type}</Td>
              <Td className="max-w-xs truncate">{p.name}</Td>
              <Td mono>{p.supplierProductCode.slice(0, 32)}</Td>
              <Td className="tabular-nums">{p.wholesaleCost.toString()} {p.wholesaleCurrency}</Td>
              <Td className="tabular-nums">{price ? formatMoney(price.unitPrice, price.currency) : <span className="text-destructive">No price</span>}</Td>
              <Td className="tabular-nums">{price ? formatMoney(price.grossProfit, price.currency) : "—"}</Td>
              <Td>{p.isActive ? "Available" : <span className="text-muted-foreground">Unavailable</span>}</Td>
              <Td>
                {manage ? (
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="value" value={p.isVisible ? "false" : "true"} />
                    <input type="hidden" name="back" value="/admin/products" />
                    <button className="h-7 rounded border px-2 text-xs">{p.isVisible ? "Hide" : "Show"}</button>
                  </form>
                ) : p.isVisible ? "Yes" : "No"}
              </Td>
              <Td className="text-muted-foreground">{formatRelative(p.lastSyncedAt)}</Td>
            </tr>
          );
        })}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/products" params={{ q, type }} />
    </>
  );
}
