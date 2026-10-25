import { Clock, Search, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceRow } from "@/components/catalog/service-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { getVerificationCountry } from "@/server/catalog/queries";

type Params = { country: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { country } = await params;
  const result = await getVerificationCountry(country);
  if (!result) return { title: "Country not found" };
  return {
    title: `${result.country.name} numbers for SMS verification`,
    description: `Temporary ${result.country.name} phone numbers for receiving SMS verification codes. Live availability and prices per service.`,
    alternates: { canonical: `/verification/${result.country.slug}` },
  };
}

export default async function VerificationCountryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ country }, sp] = await Promise.all([params, searchParams]);
  const result = await getVerificationCountry(country);
  if (!result) notFound();
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 80) : "";
  const services = q ? result.services.filter((s) => s.name.toLowerCase().includes(q) || s.slug.includes(q)) : result.services;
  const available = result.services.filter((s) => s.totalStock > 0).length;

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="py-10">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Verification numbers", href: "/verification" }, { label: result.country.name }]}
          />
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-accent-foreground shadow-card">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Step 2 of 3 · Choose a service
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Flag code={result.country.code} size="lg" />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{result.country.name} numbers</h1>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
            {result.country.phoneCode && <span className="font-medium text-foreground">{result.country.phoneCode}</span>}
            <span>
              {available} of {result.services.length} services available
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Clock className="size-4" aria-hidden /> Refreshed {formatRelative(result.country.offersSyncedAt)}
            </span>
          </p>
        </Container>
      </section>

      <Container className="py-10">
        <section aria-labelledby="inventory" className="surface overflow-hidden">
          <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="inventory" className="text-lg font-semibold">
                Verification inventory
              </h2>
              <p className="text-sm text-muted-foreground">Live availability and prices from our supplier.</p>
            </div>
            <form action={`/verification/${result.country.slug}`} method="get" role="search" className="flex gap-2 sm:w-80">
              <label htmlFor="service-search" className="sr-only">
                Search services
              </label>
              <span className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  id="service-search"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Search a service"
                  autoComplete="off"
                  maxLength={80}
                  className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 sm:text-sm"
                />
              </span>
              <Button type="submit" className="h-10">
                Search
              </Button>
            </form>
          </div>
          {services.length === 0 ? (
            <EmptyState
              className="m-5"
              icon={SearchX}
              title={q ? `No services match “${q}”` : "No numbers available in this country right now"}
              description="Availability changes constantly. Try another country or check back in a few minutes."
              action={
                <Link href="/verification" className="text-sm font-medium text-primary underline">
                  Choose another country
                </Link>
              }
            />
          ) : (
            <>
              <div
                aria-hidden
                className="hidden grid-cols-[auto_1fr_140px_120px_auto] gap-x-4 border-b bg-muted px-4 py-2.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase sm:grid"
              >
                <span className="w-9" />
                <span>Service</span>
                <span>Availability</span>
                <span className="text-right">Price</span>
                <span className="w-[86px]" />
              </div>
              <ul className="divide-y">
                {services.map((s) => (
                  <li key={s.serviceId}>
                    <ServiceRow href={`/verification/${result.country.slug}/${s.slug}`} name={s.name} fromPrice={s.fromPrice} totalStock={s.totalStock} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </Container>
    </>
  );
}
