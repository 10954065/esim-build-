"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/server/auth/permissions";
import { cn } from "@/lib/utils";

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string; perm: Permission }> }> = [
  { title: "Operations", items: [
    { href: "/admin", label: "Overview", perm: "admin.access" },
    { href: "/admin/orders", label: "Orders", perm: "orders.read" },
    { href: "/admin/esims", label: "eSIMs", perm: "orders.read" },
    { href: "/admin/verification", label: "Verification", perm: "orders.read" },
    { href: "/admin/rentals", label: "Rentals", perm: "orders.read" },
    { href: "/admin/support", label: "Support", perm: "support.manage" },
    { href: "/admin/users", label: "Users", perm: "users.read" },
  ] },
  { title: "Money", items: [
    { href: "/admin/payments", label: "Payments", perm: "payments.read" },
    { href: "/admin/refunds", label: "Refunds", perm: "payments.read" },
    { href: "/admin/analytics", label: "Profit report", perm: "reports.read" },
    { href: "/admin/pricing", label: "Pricing", perm: "pricing.read" },
  ] },
  { title: "Catalogue", items: [
    { href: "/admin/products", label: "Products", perm: "catalog.read" },
    { href: "/admin/countries", label: "Countries", perm: "catalog.read" },
    { href: "/admin/services", label: "Services", perm: "catalog.read" },
    { href: "/admin/suppliers", label: "Suppliers", perm: "catalog.read" },
  ] },
  { title: "System", items: [
    { href: "/admin/integrations", label: "Integrations", perm: "integrations.read" },
    { href: "/admin/audit-logs", label: "Audit log", perm: "audit.read" },
    { href: "/admin/settings", label: "Settings", perm: "settings.manage" },
  ] },
];

export function AdminNav({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-5 text-sm">
      {SECTIONS.map((s) => {
        const items = s.items.filter((i) => permissions.includes(i.perm));
        if (items.length === 0) return null;
        return (
          <div key={s.title}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</p>
            <ul>
              {items.map((i) => {
                const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("block rounded-md px-2 py-1.5", active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
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
