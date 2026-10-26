import { ArrowRight, Bell, Clock, MessageSquareText, Package, PhoneCall, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { EsimPass } from "@/components/dashboard/esim-pass";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getDashboardSummary } from "@/server/customer/queries";

export const metadata = { title: "Overview" };

export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const s = await getDashboardSummary(user.id);
  // An empty tile becomes a way to get started instead of a bare zero.
  const stats = [
    { label: "Active eSIMs", value: s.activeEsims, hint: "Ready or in use", icon: Smartphone, href: "/dashboard/esims", empty: { hint: "Browse travel eSIMs", href: "/esims" } },
    { label: "SMS sessions", value: s.activeVerifications, hint: "Waiting or received", icon: MessageSquareText, href: "/dashboard/verification", empty: { hint: "Get a verification number", href: "/verification" } },
    { label: "Rentals", value: s.activeRentals, hint: "Active numbers", icon: PhoneCall, href: "/dashboard/rentals", empty: { hint: "Rent a number", href: "/numbers/rentals" } },
    { label: "In progress", value: s.pendingOrders, hint: `${s.totalOrders} order${s.totalOrders === 1 ? "" : "s"} in total`, icon: Clock, href: "/dashboard/orders", empty: null },
  ].map((st) => (st.value === 0 && st.empty ? { ...st, hint: st.empty.hint, href: st.empty.href, prompt: true } : { ...st, prompt: false }));

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-8 text-ink-foreground shadow-raised sm:px-8">
        <div aria-hidden className="grid-lines absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,#000,transparent)]" />
        <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-primary/45 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-mint uppercase">Account overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {user.name.split(" ")[0]}</h1>
            <p className="mt-2 text-white/70">Your orders, eSIMs and numbers in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-10 px-4 shadow-glow">
              <Link href="/esims">
                <Plus /> Buy an eSIM
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 border-white/20 bg-white/10 px-4 text-white hover:bg-white/20 hover:text-white">
              <Link href="/verification">
                <MessageSquareText /> Get a number
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {s.currentEsims.length > 0 && (
        <section aria-labelledby="my-esims">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="my-esims" className="text-lg font-semibold">
              Your eSIMs
            </h2>
            <Link href="/dashboard/esims" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              All eSIMs <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {s.currentEsims.map((e) => (
              <li key={e.id}>
                <EsimPass e={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
              {st.prompt ? (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {st.hint} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              ) : (
                <span className="mt-1 block text-xs text-muted-foreground">{st.hint}</span>
              )}
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
            <Link href="/dashboard/orders" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold whitespace-nowrap text-primary hover:underline">
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
            <ul className="relative px-5 py-2 before:absolute before:inset-y-5 before:left-[1.6rem] before:w-px before:bg-border">
              {s.notifications.map((n) => (
                <li key={n.id} className="relative py-3 pl-6">
                  <span aria-hidden className="absolute top-[1.15rem] left-0 size-2.5 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
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
