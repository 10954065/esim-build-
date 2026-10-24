import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchBox } from "@/components/catalog/search-box";
import { ServiceRow } from "@/components/catalog/service-card";
import { EmptyState } from "@/components/common/empty-state";
import { Container, PageHeader } from "@/components/common/page-header";
import { formatRelative } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
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

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/verification" className="hover:text-foreground">Verification numbers</Link> <span aria-hidden>/</span>{" "}
        <span className="text-foreground">{result.country.name}</span>
      </nav>
      <PageHeader
        eyebrow="Step 2 of 3 · Choose a service"
        title={
          <span className="flex items-center gap-3">
            <span aria-hidden>{flagEmoji(result.country.code)}</span>
            {result.country.name} numbers
          </span>
        }
        description={`Prices and availability come live from our supplier and were refreshed ${formatRelative(result.country.offersSyncedAt)}.`}
      />
      <div className="mt-8">
        <SearchBox action={`/verification/${result.country.slug}`} defaultValue={q} placeholder="Search a service" label="Search services" />
      </div>
      {services.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={SearchX}
          title={q ? `No services match “${q}”` : "No numbers available in this country right now"}
          description="Availability changes constantly. Try another country or check back in a few minutes."
          action={<Link href="/verification" className="text-sm font-medium underline">Choose another country</Link>}
        />
      ) : (
        <ul className="mt-6 grid gap-2 md:grid-cols-2">
          {services.map((s) => (
            <li key={s.serviceId}>
              <ServiceRow href={`/verification/${result.country.slug}/${s.slug}`} name={s.name} fromPrice={s.fromPrice} totalStock={s.totalStock} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
