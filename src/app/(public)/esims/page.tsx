import { Globe2, Search, SearchX, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataOnlyNotice } from "@/components/catalog/capabilities";
import { DestinationCard } from "@/components/catalog/destination-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listEsimDestinations } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Travel eSIM data plans",
  description: "Browse prepaid travel eSIM data plans by country and region. See data, validity, network and the final price before you buy.",
  alternates: { canonical: "/esims" },
};

type Kind = "COUNTRY" | "REGION" | "GLOBAL";

const KINDS: Array<{ value: Kind | undefined; label: string }> = [
  { value: undefined, label: "All destinations" },
  { value: "COUNTRY", label: "Countries" },
  { value: "REGION", label: "Regional" },
  { value: "GLOBAL", label: "Global" },
];

const GROUPS: Array<{ kind: Kind; title: string }> = [
  { kind: "COUNTRY", title: "Countries" },
  { kind: "REGION", title: "Regional plans" },
  { kind: "GLOBAL", title: "Global plans" },
];

function filterHref(q: string | undefined, kind: Kind | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  return `/esims${params.size ? `?${params}` : ""}`;
}

export default async function EsimsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const kind = typeof sp.kind === "string" && ["COUNTRY", "REGION", "GLOBAL"].includes(sp.kind) ? (sp.kind as Kind) : undefined;
  const all = await listEsimDestinations({ q });
  const destinations = kind ? all.filter((d) => d.kind === kind) : all;
  const countOf = (k: Kind | undefined) => (k ? all.filter((d) => d.kind === k).length : all.length);

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Travel eSIMs" }]} />
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-accent-foreground shadow-card">
            <Globe2 className="size-3.5" aria-hidden /> {all.length} destination{all.length === 1 ? "" : "s"} available now
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Mobile data for wherever you land</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Pick a destination to compare plans. Every price is calculated on our servers and shown in full before checkout.
          </p>
          <form action="/esims" method="get" role="search" className="surface mt-8 flex flex-col gap-2 p-2 shadow-float sm:flex-row">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <label htmlFor="esim-search" className="sr-only">
              Search destinations
            </label>
            <span className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="esim-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search by country or region, e.g. Spain, Japan, Europe…"
                autoComplete="off"
                maxLength={80}
                className="h-12 w-full rounded-lg bg-transparent pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground"
              />
            </span>
            <Button type="submit" className="h-12 px-6">
              Search
            </Button>
            <Button asChild variant="outline" className="h-12 px-4">
              <Link href="/device-compatibility">
                <Smartphone /> Check compatibility
              </Link>
            </Button>
          </form>
        </Container>
      </section>

      <div className="border-b bg-card">
        <Container>
          <nav aria-label="Filter by destination type" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-4">
            {KINDS.map((k) => {
              const active = kind === k.value;
              return (
                <Link
                  key={k.label}
                  href={filterHref(q, k.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    active ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {k.label}
                  <span className={cn("text-xs tabular-nums", active ? "text-ink-foreground/70" : "text-muted-foreground")}>{countOf(k.value)}</span>
                </Link>
              );
            })}
          </nav>
        </Container>
      </div>

      <Container className="py-10">
        <DataOnlyNotice />

        {destinations.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={q ? SearchX : Globe2}
            title={q ? `No destinations match “${q}”` : "No destinations available right now"}
            description={
              q
                ? "Try another spelling, or browse regional and global plans that cover several countries."
                : "Our supplier catalogue is currently unavailable. Please check back shortly."
            }
            action={
              q ? (
                <Link href="/esims" className="text-sm font-medium text-primary underline">
                  Clear search
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-10 space-y-12">
            {GROUPS.map((g) => {
              const items = destinations.filter((d) => d.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <section key={g.kind} aria-labelledby={`group-${g.kind}`}>
                  <h2 id={`group-${g.kind}`} className="mb-4 text-xl font-semibold">
                    {g.title} <span className="text-base font-normal text-muted-foreground">({items.length})</span>
                  </h2>
                  <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((d) => (
                      <DestinationCard key={d.id} d={d} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
