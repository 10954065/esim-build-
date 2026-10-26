import { BellRing, CalendarClock, MessageSquareText, PhoneCall, PhoneOff, RefreshCcwDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Price } from "@/components/catalog/price";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatTerm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getRentalOffers, listRentalCountries } from "@/server/catalog/queries";
import { getStorefrontStatus } from "@/server/storefront";

export const metadata: Metadata = {
  title: "Long term virtual number rentals",
  description: "Rent a virtual phone number for days or months to receive SMS. Live terms, availability and prices from our supplier.",
  alternates: { canonical: "/numbers/rentals" },
};

const GROUPS = [
  { key: "unlimited", title: "Numbers for all services", hint: "Receives SMS from any sender for the whole term." },
  { key: "service", title: "Numbers for one service", hint: "Cheaper, but only receives SMS from the named service." },
];

const FACTS = [
  { icon: MessageSquareText, text: "Receive SMS for the whole term" },
  { icon: BellRing, text: "Reminder before the term ends" },
  { icon: RefreshCcwDot, text: "Never renewed automatically" },
  { icon: PhoneOff, text: "SMS only, no voice calls" },
];

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [countries, status] = await Promise.all([listRentalCountries(), getStorefrontStatus()]);
  const requested = typeof sp.country === "string" ? sp.country.toUpperCase() : undefined;
  const selected = countries.find((c) => c.code === requested) ?? countries[0];
  const offers = selected ? await getRentalOffers(selected.code) : [];
  const purchasable = status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Number rentals" }]} />
          <p className="eyebrow mt-6">Rentals</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Keep a number for days or months</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Rentals are for receiving SMS over a longer period. Numbers are SMS only (no voice calls) and are never renewed automatically;
            you choose whether to buy another term.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
            {FACTS.map((f) => (
              <li key={f.text} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-card">
                <f.icon className="size-3.5 text-primary" aria-hidden /> {f.text}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-10">
        {countries.length === 0 ? (
          <EmptyState icon={PhoneCall} title="No rental numbers available right now" description="Please check back later." />
        ) : (
          <>
            <nav aria-label="Choose a country" className="surface flex flex-wrap gap-2 p-3">
              {countries.map((c) => {
                const active = selected?.code === c.code;
                return (
                  <Link
                    key={c.id}
                    href={`/numbers/rentals?country=${c.code}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Flag code={c.code} />
                    {c.name}
                    {c.phoneCode && <span className={cn("text-xs", active ? "text-ink-foreground/70" : "text-muted-foreground")}>{c.phoneCode}</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-10 space-y-12">
              {GROUPS.map((g) => {
                const items = offers.filter((o) => o.rentalType === g.key);
                if (items.length === 0) return null;
                return (
                  <section key={g.key} aria-labelledby={`rent-${g.key}`}>
                    <h2 id={`rent-${g.key}`} className="text-xl font-semibold">
                      {g.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{g.hint}</p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((o) => (
                        <article key={o.productId} className="surface-interactive flex flex-col p-5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-sm font-medium">
                              <Flag code={selected?.code} />
                              {selected?.name}
                              {selected?.phoneCode && <span className="text-muted-foreground">{selected.phoneCode}</span>}
                            </span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                              {o.serviceName ? `${o.serviceName} only` : "All services"}
                            </span>
                          </div>
                          <p className="mt-5 flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                            <CalendarClock className="size-4" aria-hidden /> Rental term
                          </p>
                          <p className="mt-1 text-2xl font-bold tracking-tight">{formatTerm(o.term)}</p>
                          <div className="mt-auto pt-6">
                            <div className="flex items-end justify-between gap-3 border-t pt-4">
                              <Price value={o.price} className="text-xl text-foreground" />
                              {purchasable && o.price ? (
                                <Button asChild className="h-9 px-4">
                                  <Link href={`/checkout?product=${o.productId}`}>Rent</Link>
                                </Button>
                              ) : (
                                <Button variant="secondary" className="h-9" disabled>
                                  Unavailable
                                </Button>
                              )}
                            </div>
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
    </>
  );
}
