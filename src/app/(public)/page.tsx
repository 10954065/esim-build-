import { ArrowRight, ArrowUpRight, Check, Info } from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/catalog/destination-card";
import { ServiceInitial } from "@/components/catalog/service-card";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { AmbientVideo } from "@/components/home/ambient-video";
import { DepartureBoard } from "@/components/home/departure-board";
import { Hero } from "@/components/home/hero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAQ } from "@/content/faq";
import { cn } from "@/lib/utils";
import { listEsimDestinations, listPopularServices, listVerificationCountries } from "@/server/catalog/queries";
import { destinationSuggestions } from "@/server/catalog/suggestions";
import { dec } from "@/server/pricing/money";

const STEPS = {
  esim: [
    { title: "Choose a plan", body: "Pick a destination and a data allowance. You see the final price in cedis before paying." },
    { title: "Pay securely", body: "Your payment is verified on our server with the payment provider before anything is ordered." },
    { title: "Scan and go", body: "Your QR code and install steps appear in your dashboard. Install over Wi-Fi before you travel." },
  ],
  sms: [
    { title: "Pick country and service", body: "Choose where the number comes from and which service will send the code." },
    { title: "Pay and receive a number", body: "The number appears in your dashboard as soon as the network issues it." },
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
  { title: "Private by default", body: "eSIM activation codes and SMS messages are encrypted at rest and visible only to you." },
  { title: "Verified payments", body: "Orders are fulfilled only after a signed payment confirmation is checked on our server." },
  { title: "Clear refund rules", body: "Failed deliveries are refunded to your original payment method, confirmed with the provider." },
  { title: "Real support", body: "Open a ticket from your dashboard about any order. Every ticket is linked to its order." },
];

const LABEL = "font-mono text-[11px] font-medium tracking-[0.18em] uppercase";
const H2 = "font-heading text-[clamp(2.25rem,4.6vw,4rem)] leading-none font-medium tracking-[-0.035em]";
const ACCENT = "font-accent font-normal tracking-[-0.01em]";

function SectionLabel({ index, children, className }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn(LABEL, "flex items-center gap-3 text-muted-foreground", className)}>
      <span className="text-primary">{index}</span>
      <span aria-hidden className="h-px w-8 bg-current opacity-40" />
      {children}
    </p>
  );
}

export default async function HomePage() {
  const [destinations, services, verificationCountries, destinationOptions] = await Promise.all([
    listEsimDestinations(),
    listPopularServices(12),
    listVerificationCountries(),
    destinationSuggestions(),
  ]);
  const featured = destinations
    .filter((d) => d.fromPrice)
    .sort((a, b) => (a.kind === b.kind ? dec(a.fromPrice!.amount).cmp(dec(b.fromPrice!.amount)) : a.kind === "COUNTRY" ? -1 : 1))
    .slice(0, 8);
  const cheapest = featured[0];
  const planCount = destinations.reduce((sum, d) => sum + d.packageCount, 0);
  const board = featured.slice(0, 6).map((d) => ({
    href: `/esims/${d.slug}`,
    name: d.name,
    code: d.countryCode,
    kind: d.kind,
    packageCount: d.packageCount,
    topSpeed: d.topSpeed,
    fromPrice: d.fromPrice,
  }));

  return (
    <>
      <Hero
        destinationCount={destinations.length}
        smsCountryCount={verificationCountries.length}
        planCount={planCount}
        cheapest={cheapest ? { name: cheapest.name, href: `/esims/${cheapest.slug}`, price: cheapest.fromPrice } : null}
        options={destinationOptions}
      />

      {/* 01: live departures */}
      {board.length > 0 && (
        <section aria-labelledby="departures" className="py-24 lg:py-32">
          <Container className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="reveal">
              <SectionLabel index="01">Live departures</SectionLabel>
              <h2 id="departures" className={cn(H2, "mt-6")}>
                Prices you can <em className={cn(ACCENT, "text-foreground/60")}>land on.</em>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Every fare is calculated on our server from the network&apos;s live rates, shown in cedis and refreshed through the day.
              </p>
              <Link href="/esims" className="group mt-8 inline-flex items-center gap-2 font-semibold text-primary">
                All {destinations.length} destinations
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
            <div className="reveal">
              <DepartureBoard rows={board} />
            </div>
          </Container>
        </section>
      )}

      {/* 02: three tools, bento */}
      <section aria-labelledby="tools" className="pb-24 lg:pb-32">
        <Container>
          <div className="reveal max-w-3xl">
            <SectionLabel index="02">One trip, three tools</SectionLabel>
            <h2 id="tools" className={cn(H2, "mt-6")}>
              Data to arrive. <em className={cn(ACCENT, "text-foreground/60")}>Codes</em> to sign in.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A travel eSIM gives you mobile data. It cannot receive verification codes. For codes, use a verification number or a
              rental.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-12">
            {/* Travel eSIM */}
            <article className="reveal relative isolate flex flex-col overflow-hidden rounded-3xl bg-dusk p-8 text-white lg:col-span-7 lg:p-10">
              <div aria-hidden className="absolute -top-32 -right-24 -z-10 size-96 rounded-full bg-primary/30 blur-[110px]" />
              <p className={cn(LABEL, "text-white/60")}>Travel eSIM · Instant QR code</p>
              <h3 className="mt-5 font-heading text-4xl leading-none font-medium tracking-[-0.035em] sm:text-5xl">
                Mobile data, <em className={cn(ACCENT, "text-white/70")}>wherever</em> you land.
              </h3>
              <p className="mt-4 max-w-lg leading-relaxed text-white/75">
                Prepaid data for another country, installed by scanning a QR code. Country, regional and global plans, each with an
                install guide for iPhone and Android.
              </p>
              {cheapest && (
                <div className="mt-8 max-w-md text-foreground">
                  <p className={cn(LABEL, "mb-3 text-white/55")}>Lowest country price right now</p>
                  <DestinationCard d={cheapest} />
                </div>
              )}
              {featured.length > 1 && (
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
              <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-10">
                <p className="flex items-center gap-2 text-sm text-white/65">
                  <Info className="size-3.5 shrink-0" aria-hidden /> Data only: no phone number, SMS or calls.
                </p>
                <PillLink href="/esims" tone="light">
                  Browse destinations
                </PillLink>
              </div>
            </article>

            {/* SMS verification */}
            <article className="reveal surface flex flex-col rounded-3xl p-8 lg:col-span-5 lg:p-10">
              <p className={cn(LABEL, "text-muted-foreground")}>Verification number · Single code</p>
              <h3 className="mt-5 font-heading text-3xl leading-none font-medium tracking-[-0.03em] sm:text-4xl">
                A number for <em className={cn(ACCENT, "text-foreground/60")}>one</em> code.
              </h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                A temporary number that receives one SMS code from a supported service. The code appears in your dashboard, and
                you are refunded when no SMS arrives and the network refunds us.
              </p>
              {services.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Supported services">
                  {services.slice(0, 8).map((sv) => (
                    <li key={sv.id} className="flex items-center gap-1.5 rounded-full border bg-background py-0.5 pr-3 pl-0.5 text-sm">
                      <ServiceInitial name={sv.name} className="size-6 rounded-full text-[10px]" />
                      {sv.name}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 flex gap-2 rounded-xl bg-accent px-3.5 py-3 text-xs leading-relaxed text-accent-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Single use. Not for accounts you need to keep long term.
              </p>
              <div className="mt-auto pt-8">
                <PillLink href="/verification">Get a verification number</PillLink>
              </div>
            </article>

            {/* Rentals */}
            <article className="reveal surface flex flex-col rounded-3xl p-8 lg:col-span-5 lg:p-10">
              <p className={cn(LABEL, "text-muted-foreground")}>Number rental · Days to months</p>
              <h3 className="mt-5 font-heading text-3xl leading-none font-medium tracking-[-0.03em] sm:text-4xl">
                Keep a number <em className={cn(ACCENT, "text-foreground/60")}>longer.</em>
              </h3>
              <ul className="mt-6 space-y-3 text-[15px]">
                {["Numbers for all services or for one service", "Expiry reminders before the term ends", "Never renewed automatically"].map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">SMS only. Voice calls are not included.</p>
              <div className="mt-auto pt-8">
                <PillLink href="/numbers/rentals">Compare rental terms</PillLink>
              </div>
            </article>

            {/* Trust */}
            <article aria-labelledby="trust" className="reveal flex flex-col rounded-3xl border bg-card p-8 lg:col-span-7 lg:p-10">
              <p className={cn(LABEL, "text-muted-foreground")}>Trust and privacy</p>
              <h3 id="trust" className="mt-5 font-heading text-3xl leading-none font-medium tracking-[-0.03em] sm:text-4xl">
                Built to protect your data <em className={cn(ACCENT, "text-foreground/60")}>and</em> your money.
              </h3>
              <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {TRUST.map((t, i) => (
                  <div key={t.title} className="border-t pt-4">
                    <dt className="flex items-baseline gap-3 font-semibold">
                      <span className="font-mono text-xs text-primary tabular-nums">0{i + 1}</span>
                      {t.title}
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </Container>
      </section>

      {/* 03: popular destinations */}
      {featured.length > 0 && (
        <section aria-labelledby="featured" className="border-y bg-card py-24 lg:py-32">
          <Container>
            <div className="reveal flex flex-wrap items-end justify-between gap-6">
              <div>
                <SectionLabel index="03">Popular right now</SectionLabel>
                <h2 id="featured" className={cn(H2, "mt-6")}>
                  Where Roamwell <em className={cn(ACCENT, "text-foreground/60")}>travels.</em>
                </h2>
              </div>
              <PillLink href="/esims">All destinations</PillLink>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.slice(0, 6).map((d, i) => (
                // Phones show four; the full list is one tap away.
                <div key={d.id} className={cn("reveal", i >= 4 && "hidden sm:block")}>
                  <DestinationCard d={d} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* 04: how it works */}
      <section aria-labelledby="how" className="py-24 lg:py-32">
        <Container>
          <div className="reveal">
            <SectionLabel index="04">How it works</SectionLabel>
            <h2 id="how" className={cn(H2, "mt-6 max-w-2xl")}>
              Three steps, <em className={cn(ACCENT, "text-foreground/60")}>whichever</em> you choose.
            </h2>
          </div>
          <Tabs defaultValue="esim" className="mt-10 gap-8">
            <TabsList className="h-auto gap-1 rounded-full bg-muted p-1">
              {STEP_TABS.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="h-9 rounded-full px-5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-card">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {STEP_TABS.map(([key]) => (
              <TabsContent key={key} value={key}>
                <ol className="grid gap-4 md:grid-cols-3">
                  {STEPS[key].map((step, i) => (
                    <li key={step.title} className="surface rounded-3xl p-7">
                      <span aria-hidden className="block font-heading text-6xl leading-none font-medium tracking-tighter text-primary/80 tabular-nums">
                        0{i + 1}
                      </span>
                      <h3 className="mt-8 text-lg font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            eSIM needs a compatible, unlocked phone.
            <Link href="/device-compatibility" className="font-semibold text-primary hover:underline">
              Check device compatibility
            </Link>
          </p>
        </Container>
      </section>

      {/* 05: FAQ */}
      <section aria-labelledby="faq" className="pb-24 lg:pb-32">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="reveal">
            <SectionLabel index="05">Questions</SectionLabel>
            <h2 id="faq" className={cn(H2, "mt-6")}>
              Answered <em className={cn(ACCENT, "text-foreground/60")}>before</em> you ask.
            </h2>
            <p className="mt-6 text-muted-foreground">
              More in the{" "}
              <Link href="/faq" className="font-medium text-primary hover:underline">
                FAQ
              </Link>{" "}
              and the{" "}
              <Link href="/help" className="font-medium text-primary hover:underline">
                help centre
              </Link>
              , or{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                contact support
              </Link>
              .
            </p>
          </div>
          <div className="reveal divide-y border-y">
            {FAQ.slice(0, 5).map((item) => (
              <details key={item.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                  {item.q}
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing frame */}
      <section aria-labelledby="closing" className="p-3 sm:p-4 lg:p-5">
        <div className="grain relative isolate flex min-h-136 items-center justify-center overflow-hidden rounded-3xl bg-dusk px-6 py-24 text-center text-white sm:rounded-[2rem]">
          <div aria-hidden className="absolute inset-0 -z-10">
            <AmbientVideo src="/media/dusk-field.mp4" poster="/media/dusk-field-poster.jpg" className="object-[50%_40%]" />
            <div className="absolute inset-0 bg-dusk/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(11_16_36/0.55),transparent_70%)]" />
          </div>
          <div className="reveal max-w-3xl">
            <p className={cn(LABEL, "text-white/70")}>Ready when you are</p>
            <h2 id="closing" className="mt-6 font-heading text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-medium tracking-[-0.04em] [text-shadow:0_16px_38px_rgb(0_0_0/0.3)]">
              Your data plan, <em className={cn(ACCENT, "text-white/80")}>ready</em> before take off.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-lg text-white/85">Find your destination, see the full price, scan one QR code.</p>
            <div className="mt-10 flex justify-center">
              <PillLink href="/esims" tone="light">
                Find my plan
              </PillLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Pill call to action with the arrow in its own disc; nudges on hover, presses on click. */
function PillLink({ href, children, tone = "dark" }: { href: string; children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 items-center gap-3 rounded-full pr-1.5 pl-6 text-[15px] font-semibold transition-[transform,background-color] duration-150 focus-visible:ring-3 focus-visible:outline-none active:scale-[0.97]",
        tone === "light" ? "bg-white text-dusk hover:bg-white/90 focus-visible:ring-white/60" : "bg-ink text-white hover:bg-ink/90 focus-visible:ring-ring/50",
      )}
    >
      {children}
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full transition-transform duration-300 group-hover:-rotate-45",
          tone === "light" ? "bg-dusk text-white" : "bg-white text-ink",
        )}
      >
        <ArrowUpRight className="size-4 rotate-45" aria-hidden />
      </span>
    </Link>
  );
}
