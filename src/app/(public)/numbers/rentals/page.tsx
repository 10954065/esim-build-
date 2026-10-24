import { CalendarClock, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Price } from "@/components/catalog/price";
import { EmptyState } from "@/components/common/empty-state";
import { Container, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatTerm } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { getRentalOffers, listRentalCountries } from "@/server/catalog/queries";
import { getStorefrontStatus } from "@/server/storefront";

export const metadata: Metadata = {
  title: "Long-term virtual number rentals",
  description: "Rent a virtual phone number for days or months to receive SMS. Live terms, availability and prices from our supplier.",
  alternates: { canonical: "/numbers/rentals" },
};

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [countries, status] = await Promise.all([listRentalCountries(), getStorefrontStatus()]);
  const requested = typeof sp.country === "string" ? sp.country.toUpperCase() : undefined;
  const selected = countries.find((c) => c.code === requested) ?? countries[0];
  const offers = selected ? await getRentalOffers(selected.code) : [];
  const purchasable = status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  const groups = [
    { key: "unlimited", title: "Numbers for all services", hint: "Receives SMS from any sender for the whole term." },
    { key: "service", title: "Service-specific numbers", hint: "Cheaper, but only receives SMS from the named service." },
  ];

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Rentals"
        title="Keep a number for days or months"
        description="Rentals are for receiving SMS over a longer period. Numbers are SMS-only (no voice calls) and are never renewed automatically — you choose whether to buy another term."
      />

      {countries.length === 0 ? (
        <EmptyState className="mt-10" icon={PhoneCall} title="No rental numbers available right now" description="Please check back later." />
      ) : (
        <>
          <nav aria-label="Choose a country" className="mt-8 flex flex-wrap gap-2">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/numbers/rentals?country=${c.code}`}
                aria-current={selected?.code === c.code ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm",
                  selected?.code === c.code ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span aria-hidden>{flagEmoji(c.code)}</span>
                {c.name}
              </Link>
            ))}
          </nav>

          <div className="mt-8 space-y-10">
            {groups.map((g) => {
              const items = offers.filter((o) => o.rentalType === g.key);
              if (items.length === 0) return null;
              return (
                <section key={g.key} aria-labelledby={`rent-${g.key}`}>
                  <h2 id={`rent-${g.key}`} className="text-lg font-semibold">{g.title}</h2>
                  <p className="text-sm text-muted-foreground">{g.hint}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((o) => (
                      <article key={o.productId} className="flex flex-col rounded-xl border bg-card p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="size-4" aria-hidden />
                          {o.serviceName ? `${o.serviceName} only` : "All services"}
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{formatTerm(o.term)}</p>
                        <div className="mt-auto flex items-end justify-between pt-6">
                          <Price value={o.price} className="text-xl" />
                          {purchasable && o.price ? (
                            <Button asChild size="sm"><Link href={`/checkout?product=${o.productId}`}>Rent</Link></Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled>Unavailable</Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
            {offers.length === 0 && (
              <EmptyState title={`No rental terms available in ${selected?.name ?? "this country"}`} description="Try another country." />
            )}
          </div>
        </>
      )}
    </Container>
  );
}
