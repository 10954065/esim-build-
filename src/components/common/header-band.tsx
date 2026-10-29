import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page header on a dusk sky: the homepage hero's footage as a still, darkened on the left where
 * the copy sits. Only the media layer clips to the rounded frame, so search suggestions inside
 * can drop below it.
 */
export function HeaderBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className="p-3 sm:p-4 lg:p-5">
      <div className={cn("on-dusk relative isolate rounded-3xl bg-dusk sm:rounded-[2rem]", className)}>
        <div aria-hidden className="grain absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <div className="absolute inset-0 bg-[url(/media/hero-clouds-poster.jpg)] bg-cover bg-position-[50%_18%] opacity-80" />
          <div className="absolute inset-0 bg-linear-to-r from-dusk/95 via-dusk/75 to-dusk/30" />
          <div className="absolute inset-0 bg-linear-to-t from-dusk/70 via-transparent to-transparent" />
        </div>
        {children}
      </div>
    </section>
  );
}
