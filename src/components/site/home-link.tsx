import { House } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** A labelled way back to the storefront, for headers where the logo alone is not obvious. */
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted", className)}
    >
      <House className="size-3.5" aria-hidden /> Home
    </Link>
  );
}
