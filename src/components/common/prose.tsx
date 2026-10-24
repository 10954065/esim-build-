import type { ReactNode } from "react";
import { Container } from "./page-header";

/** Long-form content layout for policies and guides. */
export function ProsePage({ eyebrow, title, updated, intro, children }: { eyebrow?: string; title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Container className="py-12">
      <article className="mx-auto max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>}
        {intro && <div className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</div>}
        <div className="prose-content mt-10 space-y-8 text-[15px] leading-relaxed [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_section>p:first-of-type]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_ol]:text-muted-foreground [&_p]:text-muted-foreground [&_strong]:text-foreground">
          {children}
        </div>
      </article>
    </Container>
  );
}
