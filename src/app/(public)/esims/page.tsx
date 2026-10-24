import { Globe2, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataOnlyNotice } from "@/components/catalog/capabilities";
import { DestinationCard } from "@/components/catalog/destination-card";
import { SearchBox } from "@/components/catalog/search-box";
import { EmptyState } from "@/components/common/empty-state";
import { Container, PageHeader } from "@/components/common/page-header";
import { cn } from "@/lib/utils";
import { listEsimDestinations } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Travel eSIM data plans",
  description: "Browse prepaid travel eSIM data plans by country and region. See data, validity, network and the final price before you buy.",
  alternates: { canonical: "/esims" },
};

const KINDS = [
  { value: undefined, label: "All" },
  { value: "COUNTRY", label: "Countries" },
  { value: "REGION", label: "Regions" },
  { value: "GLOBAL", label: "Global" },
] as const;

type Kind = "COUNTRY" | "REGION" | "GLOBAL";

export default async function EsimsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const kind = typeof sp.kind === "string" && ["COUNTRY", "REGION", "GLOBAL"].includes(sp.kind) ? (sp.kind as Kind) : undefined;
  const destinations = await listEsimDestinations({ q, kind });

  const groups: Array<{ kind: Kind; title: string }> = [
    { kind: "COUNTRY", title: "Countries" },
    { kind: "REGION", title: "Regional plans" },
    { kind: "GLOBAL", title: "Global plans" },
  ];

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Travel eSIMs"
        title="Mobile data for wherever you land"
        description="Pick a destination to compare plans. Every price is calculated on our servers and shown in full before checkout."
      />
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox action="/esims" defaultValue={q} placeholder="Search a country or region" label="Search destinations" hidden={{ kind }} />
        <nav aria-label="Filter by destination type" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (k.value) params.set("kind", k.value);
            const active = kind === k.value;
            return (
              <Link
                key={k.label}
                href={`/esims${params.size ? `?${params}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {k.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        <DataOnlyNotice />
      </div>

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
              <Link href="/esims" className="text-sm font-medium underline">
                Clear search
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-10 space-y-12">
          {groups.map((g) => {
            const items = destinations.filter((d) => d.kind === g.kind);
            if (items.length === 0) return null;
            return (
              <section key={g.kind} aria-labelledby={`group-${g.kind}`}>
                <h2 id={`group-${g.kind}`} className="mb-4 text-lg font-semibold">
                  {g.title} <span className="font-normal text-muted-foreground">({items.length})</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
