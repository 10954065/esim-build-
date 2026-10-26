"use client";

import {
  BadgeDollarSign, Boxes, Cable, ChartNoAxesColumn, Flag, LayoutDashboard, LifeBuoy, MessageSquareText, PhoneCall,
  ReceiptText, RotateCcw, ScrollText, Settings, Shapes, Smartphone, Sparkles, Truck, Users, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/server/auth/permissions";
import { cn } from "@/lib/utils";

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string; perm: Permission; icon: LucideIcon }> }> = [
  { title: "Operations", items: [
    { href: "/admin", label: "Overview", perm: "admin.access", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", perm: "orders.read", icon: ReceiptText },
    { href: "/admin/esims", label: "eSIMs", perm: "orders.read", icon: Smartphone },
    { href: "/admin/verification", label: "Verification", perm: "orders.read", icon: MessageSquareText },
    { href: "/admin/rentals", label: "Rentals", perm: "orders.read", icon: PhoneCall },
    { href: "/admin/support", label: "Support", perm: "support.manage", icon: LifeBuoy },
    { href: "/admin/users", label: "Users", perm: "users.read", icon: Users },
  ] },
  { title: "Money", items: [
    { href: "/admin/payments", label: "Payments", perm: "payments.read", icon: BadgeDollarSign },
    { href: "/admin/refunds", label: "Refunds", perm: "payments.read", icon: RotateCcw },
    { href: "/admin/analytics", label: "Profit report", perm: "reports.read", icon: ChartNoAxesColumn },
    { href: "/admin/pricing", label: "Pricing", perm: "pricing.read", icon: Sparkles },
  ] },
  { title: "Catalogue", items: [
    { href: "/admin/products", label: "Products", perm: "catalog.read", icon: Boxes },
    { href: "/admin/countries", label: "Countries", perm: "catalog.read", icon: Flag },
    { href: "/admin/services", label: "Services", perm: "catalog.read", icon: Shapes },
    { href: "/admin/suppliers", label: "Suppliers", perm: "catalog.read", icon: Truck },
  ] },
  { title: "System", items: [
    { href: "/admin/integrations", label: "Integrations", perm: "integrations.read", icon: Cable },
    { href: "/admin/audit-logs", label: "Audit log", perm: "audit.read", icon: ScrollText },
    { href: "/admin/settings", label: "Settings", perm: "settings.manage", icon: Settings },
  ] },
];

const TONES = {
  dark: {
    heading: "text-white/55",
    active: "bg-white/10 font-semibold text-white",
    iconActive: "text-[#8fb0ff]",
    idle: "text-white/65 hover:bg-white/5 hover:text-white",
  },
  light: {
    heading: "text-muted-foreground",
    active: "bg-accent font-semibold text-primary",
    iconActive: "text-primary",
    idle: "text-muted-foreground hover:bg-muted hover:text-foreground",
  },
} as const;

/** `dark` sits on the ink sidebar; `light` is the mobile menu in the white top bar. */
export function AdminNav({ permissions, tone = "dark" }: { permissions: Permission[]; tone?: keyof typeof TONES }) {
  const pathname = usePathname();
  const t = TONES[tone];
  return (
    <nav aria-label="Admin" className="space-y-6 text-sm">
      {SECTIONS.map((s) => {
        const items = s.items.filter((i) => permissions.includes(i.perm));
        if (items.length === 0) return null;
        return (
          <div key={s.title}>
            <p className={cn("mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] uppercase", t.heading)}>{s.title}</p>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors", active ? t.active : t.idle)}
                    >
                      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
                      <i.icon className={cn("size-4 shrink-0", active ? t.iconActive : "opacity-70")} aria-hidden />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
