import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import { Container } from "./page-header";

const PROSE =
  "space-y-10 text-[15px] leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 [&_a:hover]:underline [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:font-semibold [&_li]:mt-1.5 [&_li]:marker:text-primary [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-muted-foreground [&_p]:mt-3 [&_p]:text-muted-foreground [&_section>p:first-of-type]:mt-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground";

interface ContentHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  updated?: string;
  /** Match the width of the content below: `narrow` for articles, `wide` for card grids. */
  width?: "narrow" | "wide";
}

/** Tinted header band with breadcrumbs used by guides, policies and help pages. */
export function ContentHeader({ eyebrow, title, description, updated, width = "narrow" }: ContentHeaderProps) {
  return (
    <section className="border-b bg-linear-to-b from-accent/70 to-background">
      <Container className="py-10">
        <div className={cn(width === "narrow" && "mx-auto max-w-3xl")}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
          {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          {updated && <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>}
          {description && <div className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{description}</div>}
        </div>
      </Container>
    </section>
  );
}

/** Long-form content layout for policies and guides. */
export function ProsePage({ eyebrow, title, updated, intro, children }: { eyebrow?: string; title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <>
      <ContentHeader eyebrow={eyebrow} title={title} updated={updated} description={intro} />
      <Container className="py-10">
        <article className="surface mx-auto max-w-3xl p-6 sm:p-10">
          <div className={PROSE}>{children}</div>
        </article>
      </Container>
    </>
  );
}
