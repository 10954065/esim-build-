"use client";

import {
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Package,
  PhoneCall,
  RotateCcw,
  Shield,
  Smartphone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/orders", label: "Orders", icon: Package },
  { href: "/dashboard/esims", label: "eSIMs", icon: Smartphone },
  { href: "/dashboard/verification", label: "Verification", icon: MessageSquareText },
  { href: "/dashboard/rentals", label: "Rentals", icon: PhoneCall },
  { href: "/dashboard/transactions", label: "Transactions", icon: CreditCard },
  { href: "/dashboard/refunds", label: "Refunds", icon: RotateCcw },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/security", label: "Security", icon: Shield },
];

export function DashboardNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className={cn("flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible", className)}>
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:py-2.5",
              active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
      className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", className)}
    >
      <LogOut className="size-4" aria-hidden /> Sign out
    </button>
  );
}
