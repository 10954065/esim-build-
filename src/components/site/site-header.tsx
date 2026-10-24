import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { PRIMARY_NAV } from "./nav-links";

export interface HeaderUser {
  name: string;
  isStaff: boolean;
}

export function SiteHeader({ user, currency }: { user: HeaderUser | null; currency: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground lg:inline"
            title="Prices are shown and charged in this currency"
          >
            {currency}
          </span>
          {user ? (
            <>
              {user.isStaff && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
          <MobileNav isSignedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
