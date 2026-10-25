import {
  ArrowRight,
  Check,
  CreditCard,
  Info,
  LifeBuoy,
  Lock,
  MessageSquareText,
  PhoneCall,
  QrCode,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/catalog/destination-card";
import { ServiceInitial } from "@/components/catalog/service-card";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { ProductFinder } from "@/components/home/product-finder";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAQ } from "@/content/faq";
import { listEsimDestinations, listPopularServices, listRentalCountries, listVerificationCountries } from "@/server/catalog/queries";
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
    tag: "One-time code",
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
    points: ["All-services or service-specific numbers", "Expiry reminders before the term ends", "Never renewed automatically"],
    notice: "SMS only. Voice calls are not included.",
    cta: { href: "/numbers/rentals", label: "Compare rental terms" },
    showServices: false,
  },
] as const;

const STEPS = {
  esim: [
    { title: "Choose a plan", body: "Pick a destination and a data allowance. You see the final price and currency before paying." },
    { title: "Pay securely", body: "Your payment is verified server-side with the payment provider before anything is ordered." },
    { title: "Scan and go", body: "Your QR code and install steps appear in your dashboard. Install over Wi-Fi before you travel." },
  ],
  sms: [
    { title: "Pick country and service", body: "Choose where the number comes from and which service will send the code." },
    { title: "Pay and receive a number", body: "The number appears in your dashboard as soon as the supplier issues it." },
    { title: "Read your code", body: "Request the code in the service's app; the SMS shows in your dashboard, visible only to you." },
  ],
  rental: [
    { title: "Pick a term", body: "Compare all-services and service-specific numbers by country, term and price." },
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
  { icon: CreditCard, title: "Verified payments", body: "Orders are fulfilled only after signed, server-side payment confirmation — never on a browser redirect alone." },
  { icon: RotateCcw, title: "Clear refund rules", body: "Failed deliveries are refunded to your original payment method. Refunds are confirmed with the payment provider." },
  { icon: LifeBuoy, title: "Real support", body: "Open a ticket from your dashboard about any order. Every ticket is linked to the order it concerns." },
];

export default async function HomePage() {
  const [destinations, services, verificationCountries, rentalCountries] = await Promise.all([
    listEsimDestinations(),
    listPopularServices(12),
    listVerificationCountries(),
    listRentalCountries(),
  ]);
  const featured = destinations
    .filter((d) => d.fromPrice)
    .sort((a, b) => (a.kind === b.kind ? dec(a.fromPrice!.amount).cmp(dec(b.fromPrice!.amount)) : a.kind === "COUNTRY" ? -1 : 1))
    .slice(0, 8);
  const preview = featured.find((d) => d.kind === "COUNTRY") ?? featured[0];
  const previewService = services[0];

  return (
    <>
      {/* Hero */}
      <section className="relative border-b bg-linear-to-b from-accent/60 to-background">
        <Container className="grid grid-cols-1 gap-12 pt-14 pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Travel data · SMS verification · Number rentals
            </p>
            <h1 className="mt-6 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Mobile data for wherever you land.
              <span className="block text-primary">Verify without a SIM swap.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Prepaid travel eSIM data plans and temporary phone numbers for SMS verification — priced up front, paid securely and
              delivered to your private dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-11 px-5">
                <Link href="/esims">
                  Explore travel eSIMs <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 bg-card px-5">
                <Link href="/verification">
                  <MessageSquareText /> Get a verification number
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t pt-6">
              <div>
                <dt className="text-xs text-muted-foreground">eSIM destinations</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{destinations.length || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Verification countries</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{verificationCountries.length || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Hidden fees</dt>
                <dd className="mt-1 text-2xl font-bold">None</dd>
              </div>
            </dl>
          </div>

          {/* What you get after checkout (illustration using live catalogue names) */}
          <figure className="relative" aria-label="Example of your dashboard after checkout">
            <div className="surface p-5 shadow-modal">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-[#f97066]" />
                  <span className="size-2.5 rounded-full bg-[#fdb022]" />
                  <span className="size-2.5 rounded-full bg-mint" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Example · your dashboard</span>
              </div>
              <div className="mt-4 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <Flag code={preview?.countryCode ?? "ES"} kind={preview?.kind ?? "COUNTRY"} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{preview?.name ?? "Spain"} eSIM</p>
                    <p className="text-xs text-muted-foreground">Data only · no phone number</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-success">
                    <span className="size-1.5 rounded-full bg-mint" aria-hidden /> Ready to install
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 rounded-lg bg-muted p-3">
                  <span className="grid size-16 shrink-0 place-items-center rounded-md border bg-card">
                    <QrCode className="size-10 text-foreground" aria-hidden />
                  </span>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Scan with your phone camera, or open the install link on the phone itself. Step-by-step guides for iPhone and Android.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border p-4">
                <ServiceInitial name={previewService?.name ?? "Google"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{previewService?.name ?? "Google"} verification</p>
                  <p className="font-mono text-xs text-muted-foreground">Code: ••• •••</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning">
                  <span className="size-1.5 rounded-full bg-[#f59e0b]" aria-hidden /> Waiting for SMS
                </span>
              </div>
            </div>
          </figure>
        </Container>
      </section>

      {/* Product finder overlapping the hero edge */}
      <Container className="relative z-10 -mt-12">
        <ProductFinder
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
            Three different products — know which one you need
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A travel eSIM gives you mobile data. It cannot receive verification codes. For codes, use a verification number or a rental.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <article key={p.title} className="surface flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                    <p.icon className="size-5" aria-hidden />
                  </span>
                  <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{p.tag}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {p.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 flex gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs leading-relaxed text-accent-foreground">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                  {p.notice}
                </p>
                {p.showServices && services.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Supported services">
                    {services.slice(0, 6).map((s) => (
                      <li key={s.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs">
                        <ServiceInitial name={s.name} className="size-5 rounded-full text-[10px]" />
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto pt-6">
                  <Button asChild variant="outline" className="h-10 w-full bg-card">
                    <Link href={p.cta.href}>
                      {p.cta.label} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
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
                <p className="mt-2 text-muted-foreground">Live plans and server-calculated prices.</p>
              </div>
              <Link href="/esims" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                All destinations <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Trust — only implemented capabilities */}
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

      {/* CTA band */}
      <section className="bg-primary py-16 text-primary-foreground">
        <Container className="text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em]">Land connected</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Find a data plan for your destination, see the full price, and install it before you fly.
          </p>
          <Button asChild variant="secondary" className="mt-8 h-11 bg-card px-6 text-foreground hover:bg-card/90">
            <Link href="/esims">
              Find my destination plan <ArrowRight />
            </Link>
          </Button>
        </Container>
      </section>
    </>
  );
}
