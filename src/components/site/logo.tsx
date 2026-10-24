import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2 font-semibold tracking-tight", className)}
      aria-label={`${siteConfig.name} home`}
    >
      <span aria-hidden className="relative grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12a7 7 0 0 1 14 0" />
          <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <path d="M12 13v6" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand ring-2 ring-background" />
      </span>
      <span className="text-[1.05rem]">{siteConfig.name}</span>
    </Link>
  );
}
