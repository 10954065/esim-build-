import { ArrowRight, Bell, Clock, MessageSquareText, Package, PhoneCall, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getDashboardSummary } from "@/server/customer/queries";

export const metadata = { title: "Overview" };

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const s = await getDashboardSummary(user.id);
  const stats = [
    { label: "Active eSIMs", value: s.activeEsims, hint: "Ready or in use", icon: Smartphone, href: "/dashboard/esims" },
    { label: "SMS sessions", value: s.activeVerifications, hint: "Waiting or received", icon: MessageSquareText, href: "/dashboard/verification" },
    { label: "Rentals", value: s.activeRentals, hint: "Active numbers", icon: PhoneCall, href: "/dashboard/rentals" },
    { label: "In progress", value: s.pendingOrders, hint: `${s.totalOrders} order${s.totalOrders === 1 ? "" : "s"} in total`, icon: Clock, href: "/dashboard/orders" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Account overview</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-muted-foreground">Your orders, eSIMs and numbers in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-10 px-4">
            <Link href="/esims">
              <Plus /> Buy an eSIM
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 bg-accent px-4 text-primary hover:bg-accent/70">
            <Link href="/verification">
              <MessageSquareText /> Get a number
            </Link>
          </Button>
        </div>
      </div>

      <ul aria-label="Account summary" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((st) => (
          <li key={st.label}>
            <Link href={st.href} className="surface-interactive group block h-full p-5">
              <span className="flex items-start justify-between">
                <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{st.label}</span>
                <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
                  <st.icon className="size-4" aria-hidden />
                </span>
              </span>
              <span className="mt-3 block text-3xl font-bold tabular-nums">{st.value}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{st.hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_320px]">
        <section aria-labelledby="recent-orders" className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 id="recent-orders" className="font-semibold">
                Recent orders
              </h2>
              <p className="text-xs text-muted-foreground">Your latest purchases and their delivery status.</p>
            </div>
            <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View all <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {s.recentOrders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Package className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">No orders yet. Your purchases will appear here.</p>
            </div>
          ) : (
            <OrdersTable orders={s.recentOrders} />
          )}
        </section>

        <section aria-labelledby="notifications" className="surface overflow-hidden">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Bell className="size-4 text-primary" aria-hidden />
            <h2 id="notifications" className="font-semibold">
              Notifications
            </h2>
          </div>
          {s.notifications.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            <ul className="divide-y">
              {s.notifications.map((n) => (
                <li key={n.id} className="px-5 py-3.5">
                  {n.link ? (
                    <Link href={n.link} className="text-sm font-semibold hover:text-primary">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold">{n.title}</p>
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
