import { toggleServiceAction } from "@/app/admin/actions";
import { AdminHeader, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "Services" };

export default async function AdminServices({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("catalog.read");
  const sp = await searchParams;
  const manage = can(staff.role, "catalog.manage");
  const services = await db.service.findMany({ orderBy: [{ popular: "desc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  return (
    <>
      <AdminHeader title="Verification services" description="Disable services you do not want to sell (for example, where your supplier's terms or local rules prohibit it)." />
      <ActionNotice sp={sp} />
      <Table head={["Service", "Slug", "Popular", "Supplier active", "Offers", "Enabled"]} empty={services.length === 0}>
        {services.map((s) => (
          <tr key={s.id}>
            <Td>{s.name}</Td>
            <Td mono>{s.slug}</Td>
            <Td>{s.popular ? "Yes" : "—"}</Td>
            <Td>{s.isActive ? "Yes" : "No"}</Td>
            <Td>{s._count.products}</Td>
            <Td>
              {manage ? (
                <form action={toggleServiceAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="value" value={s.isEnabled ? "false" : "true"} />
                  <input type="hidden" name="back" value="/admin/services" />
                  <button className="h-7 rounded border px-2 text-xs">{s.isEnabled ? "Disable" : "Enable"}</button>
                </form>
              ) : s.isEnabled ? "Yes" : "No"}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
