"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PRIMARY_NAV } from "./nav-links";

export function MobileNav({ isSignedIn }: { isSignedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted focus-visible:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <div className="my-3 h-px bg-border" />
          {isSignedIn ? (
            <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
                Sign in
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
                Create account
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
