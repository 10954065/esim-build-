import { MessageSquareText, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/catalog/search-box";
import { ServiceInitial } from "@/components/catalog/service-card";
import { EmptyState } from "@/components/common/empty-state";
import { Container, PageHeader } from "@/components/common/page-header";
import { flagEmoji } from "@/lib/slug";
import { listPopularServices, listVerificationCountries } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Temporary numbers for SMS verification",
  description: "Choose a country and service to get a temporary phone number for receiving an SMS verification code. Live availability and prices.",
  alternates: { canonical: "/verification" },
};

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const [countries, services] = await Promise.all([listVerificationCountries(q), listPopularServices(10)]);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="SMS verification"
        title="A temporary number for one verification code"
        description={
          <>
            Pick a country, then the service you are verifying. You receive a number from our supplier after payment and see incoming
            SMS in your private dashboard. Not every service accepts temporary numbers, and delivery is never guaranteed — see the{" "}
            <Link href="/refund-policy" className="font-medium text-foreground underline underline-offset-2">refund policy</Link>.
          </>
        }
      />

      <div className="mt-8 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">One-time activation vs. rental.</strong> A verification number is for receiving a code for a
        single service within a short time limit. If you need a number for days or months, see{" "}
        <Link href="/numbers/rentals" className="font-medium text-foreground underline underline-offset-2">long-term rentals</Link>.
      </div>

      {services.length > 0 && (
        <section aria-labelledby="popular" className="mt-10">
          <h2 id="popular" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Supported services</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm">
                <ServiceInitial name={s.name} className="size-6 rounded-full text-xs" />
                {s.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="countries" className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="countries" className="text-lg font-semibold">Choose a country</h2>
          <SearchBox action="/verification" defaultValue={q} placeholder="Search countries" label="Search countries" className="sm:max-w-sm" />
        </div>
        {countries.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={q ? SearchX : MessageSquareText}
            title={q ? `No countries match “${q}”` : "No verification numbers available right now"}
            description={q ? "Check the spelling or browse the full list." : "Supplier inventory is currently unavailable. Please try again later."}
          />
        ) : (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {countries.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/verification/${c.slug}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xl" aria-hidden>{flagEmoji(c.code)}</span>
                  <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                  {c.phoneCode && <span className="font-mono text-xs text-muted-foreground">{c.phoneCode}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
