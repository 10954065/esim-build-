import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/** "Home › Travel eSIMs › Spain" trail; the last crumb is the current page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className="hover:text-primary">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-foreground")}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden>
                  <ChevronRight className="size-3" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
