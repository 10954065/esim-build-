import { setUserBanAction, setUserRoleAction } from "@/app/admin/actions";
import { AdminHeader, Filters, Pager, Table, Td } from "@/components/admin/admin-ui";
import { ActionNotice, sp1, type SearchParams } from "@/components/admin/notice";
import { formatDate } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";
import { listUsers, pages } from "@/server/admin/queries";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff("users.read");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const page = Number(sp1(sp, "page") ?? 1);
  const data = await listUsers({ q, page });
  const manage = can(staff.role, "users.manage");
  return (
    <>
      <AdminHeader title="Users" description="Role changes and suspensions sign the user out everywhere and are audit-logged." />
      <ActionNotice sp={sp} />
      <Filters action="/admin/users" q={q} />
      <Table head={["Email", "Name", "Role", "Verified", "2FA", "Orders", "Joined", "Status", ...(manage ? ["Actions"] : [])]} empty={data.items.length === 0}>
        {data.items.map((u) => (
          <tr key={u.id}>
            <Td>{u.email}</Td>
            <Td>{u.name}</Td>
            <Td>{u.role}</Td>
            <Td>{u.emailVerified ? "Yes" : "No"}</Td>
            <Td>{u.twoFactorEnabled ? "On" : "Off"}</Td>
            <Td>{u._count.orders}</Td>
            <Td className="text-muted-foreground">{formatDate(u.createdAt)}</Td>
            <Td>{u.banned ? <span className="text-destructive">Suspended</span> : u.profile?.deletionRequestedAt ? <span className="text-warning">Deletion requested</span> : "Active"}</Td>
            {manage && (
              <Td>
                {u.id !== staff.id && (
                  <div className="flex flex-col gap-1">
                    <form action={setUserRoleAction} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="back" value="/admin/users" />
                      <select name="role" defaultValue={u.role} className="h-7 rounded border bg-background text-xs">
                        {["user", "support", "finance", "admin"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <input name="reason" required minLength={5} placeholder="Reason" className="h-7 w-28 rounded border bg-background px-1 text-xs" />
                      <button className="h-7 rounded border px-2 text-xs">Set role</button>
                    </form>
                    <form action={setUserBanAction} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="ban" value={u.banned ? "false" : "true"} />
                      <input type="hidden" name="back" value="/admin/users" />
                      <input name="reason" required minLength={5} placeholder="Reason" className="h-7 w-28 rounded border bg-background px-1 text-xs" />
                      <button className="h-7 rounded border px-2 text-xs">{u.banned ? "Reinstate" : "Suspend"}</button>
                    </form>
                  </div>
                )}
              </Td>
            )}
          </tr>
        ))}
      </Table>
      <Pager page={data.page} totalPages={pages(data.total)} base="/admin/users" params={{ q }} />
    </>
  );
}
