import {
  ArrowRight,
  Check,
  CreditCard,
  Info,
  LifeBuoy,
  Lock,
  MessageSquareText,
  PhoneCall,
  RotateCcw,
  Search,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/catalog/destination-card";
import { ServiceInitial } from "@/components/catalog/service-card";
import { Flag } from "@/components/common/flag";
import { SearchCombobox } from "@/components/common/search-combobox";
import { Container } from "@/components/common/page-header";
import { DepartureBoard } from "@/components/home/departure-board";
import { FlagMarquee } from "@/components/home/flag-marquee";
import { ProductFinder } from "@/components/home/product-finder";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAQ } from "@/content/faq";
import { listEsimDestinations, listPopularServices, listRentalCountries, listVerificationCountries } from "@/server/catalog/queries";
import { destinationSuggestions } from "@/server/catalog/suggestions";
import { dec } from "@/server/pricing/money";

const PRODUCTS = [
  {
    icon: Smartphone,
    tag: "Instant QR code",
    title: "Travel eSIMs",
    body: "Prepaid mobile data for another country, installed by scanning a QR code. No physical SIM swap.",
    points: ["Country, regional and global plans", "Price shown in full before checkout", "Install guide for iPhone and Android"],
    notice: "Data only: no phone number, SMS or calls.",
    cta: { href: "/esims", label: "Browse eSIM destinations" },
    showServices: false,
  },
  {
    icon: MessageSquareText,
    tag: "Single code",
    title: "SMS verification",
    body: "A temporary number that receives one SMS code from a supported service, for a limited time.",
    points: ["Choose the country and the service", "Code appears in your dashboard", "Refunded when no SMS arrives and the supplier refunds"],
    notice: "Single use. Not for accounts you need to keep long term.",
    cta: { href: "/verification", label: "Get a verification number" },
    showServices: true,
  },
  {
    icon: PhoneCall,
    tag: "Days to months",
    title: "Number rentals",
    body: "Keep a number for a fixed term to receive SMS over a longer period.",
    points: ["Numbers for all services or for one service", "Expiry reminders before the term ends", "Never renewed automatically"],
    notice: "SMS only. Voice calls are not included.",
    cta: { href: "/numbers/rentals", label: "Compare rental terms" },
    showServices: false,
  },
] as const;

const STEPS = {
  esim: [
    { title: "Choose a plan", body: "Pick a destination and a data allowance. You see the final price and currency before paying." },
    { title: "Pay securely", body: "Your payment is verified on our server with the payment provider before anything is ordered." },
    { title: "Scan and go", body: "Your QR code and install steps appear in your dashboard. Install over Wi-Fi before you travel." },
  ],
  sms: [
    { title: "Pick country and service", body: "Choose where the number comes from and which service will send the code." },
    { title: "Pay and receive a number", body: "The number appears in your dashboard as soon as the supplier issues it." },
    { title: "Read your code", body: "Request the code in the service's app; the SMS shows in your dashboard, visible only to you." },
  ],
  rental: [
    { title: "Pick a term", body: "Compare numbers for all services and for one service by country, term and price." },
    { title: "Pay once", body: "There is no subscription: rentals are never renewed automatically." },
    { title: "Receive SMS", body: "Messages arrive in your dashboard for the whole term, with a reminder before it ends." },
  ],
};

const STEP_TABS = [
  ["esim", "eSIM"],
  ["sms", "SMS verification"],
  ["rental", "Rentals"],
] as const;

const TRUST = [
  { icon: Lock, title: "Private by default", body: "eSIM activation codes and SMS messages are encrypted at rest and visible only to you when signed in." },
  { icon: CreditCard, title: "Verified payments", body: "Orders are fulfilled only after a signed payment confirmation checked on our server, never on a browser redirect alone." },
  { icon: RotateCcw, title: "Clear refund rules", body: "Failed deliveries are refunded to your original payment method. Refunds are confirmed with the payment provider." },
  { icon: LifeBuoy, title: "Real support", body: "Open a ticket from your dashboard about any order. Every ticket is linked to the order it concerns." },
];

export default async function HomePage() {
  const [destinations, services, verificationCountries, rentalCountries, destinationOptions] = await Promise.all([
    listEsimDestinations(),
    listPopularServices(12),
    listVerificationCountries(),
    listRentalCountries(),
    destinationSuggestions(),
  ]);
  const featured = destinations
    .filter((d) => d.fromPrice)
    .sort((a, b) => (a.kind === b.kind ? dec(a.fromPrice!.amount).cmp(dec(b.fromPrice!.amount)) : a.kind === "COUNTRY" ? -1 : 1))
    .slice(0, 8);
  const board = featured.slice(0, 6).map((d) => ({
    href: `/esims/${d.slug}`,
    name: d.name,
    code: d.countryCode,
    kind: d.kind,
    packageCount: d.packageCount,
    topSpeed: d.topSpeed,
    fromPrice: d.fromPrice,
  }));
  const marquee = destinations
    .filter((d) => d.kind === "COUNTRY" && d.countryCode)
    .map((d) => ({ href: `/esims/${d.slug}`, name: d.name, code: d.countryCode! }));

  return (
    <>
      {/* Hero: ink canvas, search as the primary action, live departure board */}
      <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden className="grid-lines absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_75%)]" />
        <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/35 blur-[120px]" />
        <div aria-hidden className="absolute right-[-10rem] bottom-[-12rem] -z-10 size-[28rem] rounded-full bg-mint/15 blur-[110px]" />
        <Container className="grid grid-cols-1 gap-12 pt-16 pb-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24 lg:pb-20">
          <div className="stagger">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-mint" aria-hidden /> Travel data · SMS verification · Number rentals
            </p>
            <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              Land connected.
              <span className="block bg-linear-to-r from-[#8fb0ff] via-white to-mint bg-clip-text text-transparent">Anywhere you fly.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Prepaid travel eSIM data and temporary numbers for SMS codes. Priced in full before you pay, verified on our server,
              delivered to your private dashboard.
            </p>
            <form action="/esims" method="get" role="search" className="relative z-20 mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-glow backdrop-blur sm:flex-row">
              <label htmlFor="hero-search" className="sr-only">
                Where are you travelling?
              </label>
              <span className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/60" aria-hidden />
                <SearchCombobox
                  id="hero-search"
                  options={destinationOptions}
                  listLabel="Destinations"
                  placeholder="Where are you travelling?"
                  className="h-12 w-full rounded-xl bg-transparent pr-4 pl-12 text-base text-white outline-none placeholder:text-white/55"
                />
              </span>
              <Button type="submit" className="h-12 rounded-xl px-6 text-base">
                Find plans <ArrowRight />
              </Button>
            </form>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-xs tracking-wide text-white/60 uppercase">eSIM destinations</dt>
                <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">{destinations.length || "None yet"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-white/60 uppercase">SMS countries</dt>
                <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">{verificationCountries.length || "None yet"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-white/60 uppercase">Hidden fees</dt>
                <dd className="mt-1 font-heading text-3xl font-bold">None</dd>
              </div>
            </dl>
          </div>
          {board.length > 0 && <DepartureBoard rows={board} />}
        </Container>
        <div className="border-t border-white/10 pt-5 pb-20">
          <FlagMarquee items={marquee} label="eSIM destinations" />
        </div>
      </section>

      {/* Product finder overlapping the hero edge */}
      <Container className="relative z-10 -mt-14">
        <ProductFinder
          esimOptions={destinationOptions}
          destinations={featured.slice(0, 6).map((d) => ({ href: `/esims/${d.slug}`, name: d.name, code: d.countryCode, kind: d.kind }))}
          verificationCountries={verificationCountries.slice(0, 8).map((c) => ({ href: `/verification/${c.slug}`, name: c.name, code: c.code }))}
          rentalCountries={rentalCountries.slice(0, 8).map((c) => ({ href: `/numbers/rentals?country=${c.code}`, name: c.name, code: c.code }))}
        />
      </Container>

      {/* Three product lines */}
      <section aria-labelledby="products" className="py-20">
        <Container>
          <p className="eyebrow">Three products</p>
          <h2 id="products" className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Three different products. Know which one you need.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A travel eSIM gives you mobile data. It cannot receive verification codes. For codes, use a verification number or a rental.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:grid-rows-2">
            {PRODUCTS.map((p, i) => {
              const featuredCard = i === 0;
              return (
                <article
                  key={p.title}
                  className={
                    featuredCard
                      ? "relative isolate flex flex-col overflow-hidden rounded-3xl bg-ink p-8 text-ink-foreground shadow-modal lg:col-span-2 lg:row-span-2"
                      : "surface flex flex-col p-6"
                  }
                >
                  {featuredCard && (
                    <>
                      <div aria-hidden className="grid-lines absolute inset-0 -z-10 opacity-70" />
                      <div aria-hidden className="absolute -right-20 -bottom-24 -z-10 size-96 rounded-full bg-primary/40 blur-[100px]" />
                    </>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <span className={featuredCard ? "grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-glow" : "grid size-11 place-items-center rounded-xl bg-accent text-primary"}>
                      <p.icon className="size-5" aria-hidden />
                    </span>
                    <span
                      className={
                        featuredCard
                          ? "rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/85"
                          : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {p.tag}
                    </span>
                  </div>
                  <h3 className={featuredCard ? "mt-8 text-4xl font-bold tracking-[-0.03em] sm:text-5xl" : "mt-5 text-xl font-semibold"}>{p.title}</h3>
                  <p className={featuredCard ? "mt-3 max-w-lg text-lg leading-relaxed text-white/75" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{p.body}</p>
                  <ul className={featuredCard ? "mt-6 grid gap-3 text-sm sm:grid-cols-3" : "mt-5 space-y-2.5 text-sm"}>
                    {p.points.map((point) => (
                      <li key={point} className={featuredCard ? "flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-white/85" : "flex gap-2"}>
                        <Check className={featuredCard ? "mt-0.5 size-4 shrink-0 text-mint" : "mt-0.5 size-4 shrink-0 text-success"} aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                  {featuredCard && featured[0] && (
                    <div className="mt-8 max-w-md">
                      <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">Lowest country price right now</p>
                      <DestinationCard d={featured[0]} />
                    </div>
                  )}
                  {featuredCard && featured.length > 1 && (
                    <ul className="mt-6 flex flex-wrap gap-2" aria-label="Popular destinations">
                      {featured.slice(1, 7).map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/esims/${d.slug}`}
                            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-3 pl-1 text-sm text-white/90 transition-colors hover:bg-white/15"
                          >
                            <Flag code={d.countryCode} kind={d.kind} size="sm" className="size-5 rounded-full object-cover" />
                            {d.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={featuredCard ? "mt-6 flex gap-2 text-sm text-white/70" : "mt-5 flex gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs leading-relaxed text-accent-foreground"}>
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    {p.notice}
                  </p>
                  {p.showServices && services.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Supported services">
                      {services.slice(0, 6).map((sv) => (
                        <li key={sv.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs">
                          <ServiceInitial name={sv.name} className="size-5 rounded-full text-[10px]" />
                          {sv.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-6">
                    {featuredCard ? (
                      <Button asChild className="h-11 px-5">
                        <Link href={p.cta.href}>
                          {p.cta.label} <ArrowRight />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="h-10 w-full bg-card">
                        <Link href={p.cta.href}>
                          {p.cta.label} <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Top destinations */}
      {featured.length > 0 && (
        <section aria-labelledby="featured" className="border-y bg-card py-20">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Popular eSIM destinations</p>
                <h2 id="featured" className="mt-2 text-3xl font-bold tracking-[-0.02em]">Top travel destinations</h2>
                <p className="mt-2 text-muted-foreground">Live plans and prices calculated on our server.</p>
              </div>
              <Link href="/esims" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                All destinations <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="stagger mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featured.map((d) => (
                <DestinationCard key={d.id} d={d} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* How it works */}
      <section aria-labelledby="how" className="py-20">
        <Container className="text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="how" className="mx-auto mt-2 max-w-xl text-3xl font-bold tracking-[-0.02em]">Three steps, whichever product you choose</h2>
          <Tabs defaultValue="esim" className="mt-8 items-center gap-8">
            <TabsList className="h-auto gap-1 rounded-[10px] bg-muted p-1">
              {STEP_TABS.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="h-9 rounded-md px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-card">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {STEP_TABS.map(([key]) => (
              <TabsContent key={key} value={key} className="w-full">
                <ol className="grid gap-5 text-left md:grid-cols-3">
                  {STEPS[key].map((step, i) => (
                    <li key={step.title} className="surface p-6">
                      <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-primary">{i + 1}</span>
                      <h3 className="mt-4 font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-8 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Smartphone className="size-4" aria-hidden /> eSIM needs a compatible, unlocked phone.
            <Link href="/device-compatibility" className="font-semibold text-primary hover:underline">
              Check device compatibility
            </Link>
          </p>
        </Container>
      </section>

      {/* Trust: only implemented capabilities */}
      <section aria-labelledby="trust" className="border-y bg-card py-20">
        <Container>
          <p className="eyebrow">Trust & privacy</p>
          <h2 id="trust" className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.02em]">Built to protect your data and your money</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <li key={t.title} className="rounded-2xl border bg-background p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-card text-primary shadow-card">
                  <t.icon className="size-5" aria-hidden />
                </span>
                <p className="mt-4 font-semibold">{t.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="py-20">
        <Container className="max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">FAQ</p>
            <h2 id="faq" className="mt-2 text-3xl font-bold tracking-[-0.02em]">Questions, answered</h2>
          </div>
          <div className="mt-8 space-y-3">
            {FAQ.slice(0, 5).map((item) => (
              <details key={item.q} className="group surface px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span aria-hidden className="text-lg text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
          <div className="surface mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">Still have questions?</p>
              <p className="text-sm text-muted-foreground">
                Read the{" "}
                <Link href="/faq" className="font-medium text-primary hover:underline">
                  FAQ
                </Link>{" "}
                or the{" "}
                <Link href="/help" className="font-medium text-primary hover:underline">
                  help centre
                </Link>
                .
              </p>
            </div>
            <Button asChild variant="outline" className="h-10">
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Closing call to action */}
      <section className="relative isolate -mb-24 overflow-hidden bg-ink py-20 text-ink-foreground">
        <div aria-hidden className="grid-lines absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]" />
        <div aria-hidden className="absolute top-1/2 left-1/2 -z-10 h-80 w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 blur-[110px]" />
        <Container className="text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-mint uppercase">Ready when you are</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Your data plan, installed before take off</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">Find your destination, see the full price, scan one QR code.</p>
          <Button asChild className="mt-8 h-12 px-7 text-base shadow-glow">
            <Link href="/esims">
              Find my destination plan <ArrowRight />
            </Link>
          </Button>
        </Container>
      </section>
    </>
  );
}
