import { updateSettingAction } from "@/app/admin/actions";
import { AdminHeader, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, type SearchParams } from "@/components/admin/notice";
import { requireStaff } from "@/server/auth/session";
import { getAllSettings, SETTINGS, type SettingKey } from "@/server/settings";

export const metadata = { title: "Settings" };

export default async function AdminSettings({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("settings.manage");
  const sp = await searchParams;
  const values = await getAllSettings();
  return (
    <>
      <AdminHeader title="Settings" description="Runtime settings that are not secret. API keys and secrets are environment variables and cannot be viewed or edited here." />
      <ActionNotice sp={sp} />
      <Table head={["Setting", "Value", ""]}>
        {(Object.keys(SETTINGS) as SettingKey[]).map((key) => {
          const value = values[key];
          const def = SETTINGS[key].default;
          return (
            <tr key={key}>
              <Td>
                <p>{SETTINGS[key].label}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{key}</p>
              </Td>
              <td colSpan={2} className="px-3 py-2.5">
                <form action={updateSettingAction} className="flex items-center gap-2">
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="back" value="/admin/settings" />
                  {typeof def === "boolean" ? (
                    <select name="value" aria-label={SETTINGS[key].label} defaultValue={String(value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  ) : (
                    <input name="value" aria-label={SETTINGS[key].label} defaultValue={String(value)} type={typeof def === "number" ? "number" : "text"} maxLength={280} className="h-8 w-80 rounded-md border bg-background px-2 text-sm" />
                  )}
                  <button className="h-8 rounded-md border px-3 text-sm">Save</button>
                </form>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
