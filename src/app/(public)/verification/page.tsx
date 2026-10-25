import { Check, MessageSquareText, PhoneCall, RotateCcw, Search, SearchX, Smartphone, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ServiceInitial } from "@/components/catalog/service-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listPopularServices, listVerificationCountries } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Temporary numbers for SMS verification",
  description: "Choose a country and service to get a temporary phone number for receiving an SMS verification code. Live availability and prices.",
  alternates: { canonical: "/verification" },
};

const SCOPE = [
  {
    icon: MessageSquareText,
    title: "Verification number",
    current: true,
    body: "A single-use number for one SMS code from one service, within a short time limit.",
    yes: ["Sign-ups and one-off checks", "Code shown in your dashboard"],
    no: ["Not for password resets later on"],
  },
  {
    icon: PhoneCall,
    title: "Number rental",
    href: "/numbers/rentals",
    body: "A number you keep for days or months to receive SMS over a longer period.",
    yes: ["Ongoing two-factor codes", "Reminder before the term ends"],
    no: ["No voice calls"],
  },
  {
    icon: Smartphone,
    title: "Travel eSIM",
    href: "/esims",
    body: "Mobile data abroad, installed on your phone with a QR code.",
    yes: ["Country, regional and global plans", "Install before you travel"],
    no: ["No phone number, cannot receive SMS"],
  },
];

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const [countries, services] = await Promise.all([listVerificationCountries(q), listPopularServices(12)]);

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <div>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Verification numbers" }]} />
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-accent-foreground shadow-card">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Step 1 of 3 · Choose a country
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">A temporary number for one verification code</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Pick a country, then the service you are verifying. You receive a number from our supplier after payment and see incoming
              SMS in your private dashboard.
            </p>

            <div className="surface mt-6 flex gap-4 border-l-4 border-l-mint p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                <RotateCcw className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Refund when no SMS arrives</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If no code arrives before the number expires and the supplier refunds the activation, we refund you automatically to your
                  original payment method. Not every service accepts temporary numbers — see the{" "}
                  <Link href="/refund-policy" className="font-medium text-primary hover:underline">
                    refund policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Countries", value: String(countries.length || "—") },
                { label: "Services", value: services.length >= 12 ? "12+" : String(services.length || "—") },
                { label: "Use", value: "One code" },
              ].map((s) => (
                <div key={s.label} className="surface p-4">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <section aria-labelledby="countries" className="surface overflow-hidden shadow-float">
            <div className="border-b p-5">
              <p className="eyebrow">Choose a country</p>
              <h2 id="countries" className="mt-1 text-lg font-semibold">
                Where should the number come from?
              </h2>
              <form action="/verification" method="get" role="search" className="mt-4 flex gap-2">
                <label htmlFor="country-search" className="sr-only">
                  Search countries
                </label>
                <span className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="country-search"
                    name="q"
                    type="search"
                    defaultValue={q}
                    placeholder="Search countries"
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
            {countries.length === 0 ? (
              <EmptyState
                className="m-5"
                icon={q ? SearchX : MessageSquareText}
                title={q ? `No countries match “${q}”` : "No verification numbers available right now"}
                description={q ? "Check the spelling or browse the full list." : "Supplier inventory is currently unavailable. Please try again later."}
              />
            ) : (
              <ul className="max-h-[26rem] divide-y overflow-y-auto">
                {countries.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/verification/${c.slug}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                    >
                      <Flag code={c.code} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        {c.phoneCode && <span className="text-xs text-muted-foreground">{c.phoneCode}</span>}
                      </span>
                      <span className="text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        Choose →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Container>
      </section>

      {services.length > 0 && (
        <Container className="pt-12">
          <section aria-labelledby="popular">
            <h2 id="popular" className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Supported services
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {services.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm font-medium shadow-card">
                  <ServiceInitial name={s.name} className="size-6 rounded-full text-xs" />
                  {s.name}
                </li>
              ))}
            </ul>
          </section>
        </Container>
      )}

      <Container className="pt-12">
        <section aria-labelledby="scope" className="rounded-2xl border border-primary/15 bg-accent p-6 sm:p-8">
          <h2 id="scope" className="text-xl font-semibold">
            Which product do you need?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Three products for three different jobs.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {SCOPE.map((s) => (
              <div key={s.title} className={cn("relative rounded-xl border bg-card p-5", s.current && "border-2 border-primary")}>
                {s.current && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    This page
                  </span>
                )}
                <div className="flex items-center gap-2.5">
                  <s.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="font-semibold">
                    {s.href ? (
                      <Link href={s.href} className="hover:text-primary">
                        {s.title}
                      </Link>
                    ) : (
                      s.title
                    )}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                <ul className="mt-4 space-y-1.5 text-xs">
                  {s.yes.map((y) => (
                    <li key={y} className="flex gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" aria-hidden /> {y}
                    </li>
                  ))}
                  {s.no.map((n) => (
                    <li key={n} className="flex gap-1.5 text-destructive">
                      <X className="size-3.5 shrink-0" aria-hidden /> {n}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
