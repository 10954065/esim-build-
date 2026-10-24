import { toggleCountryAction, toggleDestinationAction } from "@/app/admin/actions";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "Countries & destinations" };

function ToggleButton({ action, id, enabled }: { action: (fd: FormData) => Promise<never>; id: string; enabled: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="value" value={enabled ? "false" : "true"} />
      <input type="hidden" name="back" value="/admin/countries" />
      <button className="h-7 rounded border px-2 text-xs">{enabled ? "Disable" : "Enable"}</button>
    </form>
  );
}

export default async function AdminCountries({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("catalog.read");
  const sp = await searchParams;
  const manage = can(staff.role, "catalog.manage");
  const [countries, destinations] = await Promise.all([
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.esimDestination.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <>
      <AdminHeader title="Countries & destinations" description="Disable a country or eSIM destination to hide it from the storefront without deleting supplier data." />
      <ActionNotice sp={sp} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Countries (${countries.length})`}>
          <Table head={["Country", "Code", "Verification", "Rentals", "Enabled"]} empty={countries.length === 0}>
            {countries.map((c) => (
              <tr key={c.id}>
                <Td>{c.name}</Td>
                <Td mono>{c.code}</Td>
                <Td>{c.hasVerification ? "Yes" : "—"}</Td>
                <Td>{c.hasRentals ? "Yes" : "—"}</Td>
                <Td>{manage ? <ToggleButton action={toggleCountryAction} id={c.id} enabled={c.isEnabled} /> : c.isEnabled ? "Yes" : "No"}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title={`eSIM destinations (${destinations.length})`}>
          <Table head={["Destination", "Code", "Kind", "Plans", "Enabled"]} empty={destinations.length === 0}>
            {destinations.map((d) => (
              <tr key={d.id}>
                <Td>{d.name}</Td>
                <Td mono>{d.locationCode}</Td>
                <Td>{d.kind}</Td>
                <Td>{d.packageCount}</Td>
                <Td>{manage ? <ToggleButton action={toggleDestinationAction} id={d.id} enabled={d.isEnabled} /> : d.isEnabled ? "Yes" : "No"}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
