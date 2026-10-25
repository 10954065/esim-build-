import { Globe2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderNav } from "./header-nav";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

export interface HeaderUser {
  name: string;
  isStaff: boolean;
}

export function SiteHeader({ user, currency }: { user: HeaderUser | null; currency: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85">
      <div className="mx-auto flex h-16 max-w-7xl items-stretch gap-6 px-4 sm:px-8">
        <div className="flex items-center">
          <Logo />
        </div>
        <HeaderNav />
        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-card lg:inline-flex"
            title="Prices are shown and charged in this currency"
          >
            <Globe2 className="size-3.5 text-muted-foreground" aria-hidden />
            {currency}
          </span>
          {user ? (
            <>
              {user.isStaff && (
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <Button asChild className="hidden md:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="hidden md:inline-flex">
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
