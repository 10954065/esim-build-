"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-links";

/** Desktop navigation with the active section underlined in action blue. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
      {PRIMARY_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground",
              "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
              active && "text-primary after:opacity-100 hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
