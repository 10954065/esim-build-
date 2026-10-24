import { Bell, Clock, MessageSquareText, Package, PhoneCall, Smartphone } from "lucide-react";
import Link from "next/link";
import { DemoBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { formatDate, formatRelative } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getDashboardSummary } from "@/server/customer/queries";

export const metadata = { title: "Overview" };

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const s = await getDashboardSummary(user.id);
  const stats = [
    { label: "Total orders", value: s.totalOrders, icon: Package, href: "/dashboard/orders" },
    { label: "Active eSIMs", value: s.activeEsims, icon: Smartphone, href: "/dashboard/esims" },
    { label: "Orders in progress", value: s.pendingOrders, icon: Clock, href: "/dashboard/orders" },
    { label: "Active verifications", value: s.activeVerifications, icon: MessageSquareText, href: "/dashboard/verification" },
    { label: "Active rentals", value: s.activeRentals, icon: PhoneCall, href: "/dashboard/rentals" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hi {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Your orders, eSIMs and numbers in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href="/esims">Buy an eSIM</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/verification">Get a number</Link></Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((st) => (
          <Link key={st.label} href={st.href} className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
            <st.icon className="size-4 text-muted-foreground" aria-hidden />
            <dd className="mt-3 text-2xl font-semibold tabular-nums">{st.value}</dd>
            <dt className="text-xs text-muted-foreground">{st.label}</dt>
          </Link>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="recent-orders" className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 id="recent-orders" className="font-semibold">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {s.recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet. Your purchases will appear here.</p>
          ) : (
            <ul className="divide-y">
              {s.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {o.items[0]?.description ?? "Order"} <DemoBadge show={o.isSandbox} />
                      </p>
                      <p className="text-xs text-muted-foreground">{o.number} · {formatDate(o.createdAt)}</p>
                    </div>
                    <StatusBadge status={o.status} />
                    <span className="w-20 text-right text-sm tabular-nums">{formatMoney(o.total.toString(), o.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="notifications" className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <Bell className="size-4 text-muted-foreground" aria-hidden />
            <h2 id="notifications" className="font-semibold">Notifications</h2>
          </div>
          {s.notifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            <ul className="divide-y">
              {s.notifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  {n.link ? (
                    <Link href={n.link} className="block hover:underline">
                      <p className="text-sm font-medium">{n.title}</p>
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{n.title}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
