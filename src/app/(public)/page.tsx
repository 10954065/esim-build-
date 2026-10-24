import { ArrowRight, CreditCard, Globe2, Lock, MessageSquareText, QrCode, ScanLine, Smartphone } from "lucide-react";
import Link from "next/link";
import { DestinationCard } from "@/components/catalog/destination-card";
import { ServiceInitial } from "@/components/catalog/service-card";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { FAQ } from "@/content/faq";
import { listEsimDestinations, listPopularServices } from "@/server/catalog/queries";
import { dec } from "@/server/pricing/money";

export default async function HomePage() {
  const [destinations, services] = await Promise.all([listEsimDestinations(), listPopularServices(12)]);
  const featured = destinations
    .filter((d) => d.fromPrice)
    .sort((a, b) => (a.kind === b.kind ? dec(a.fromPrice!.amount).cmp(dec(b.fromPrice!.amount)) : a.kind === "COUNTRY" ? -1 : 1))
    .slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:22px_22px]"
        />
        <Container className="relative grid gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden /> Travel data · SMS verification · Number rentals
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Stay connected abroad.
              <br />
              <span className="text-muted-foreground">Verify without a SIM swap.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Prepaid travel eSIM data plans and temporary phone numbers for SMS verification — priced up front, paid securely, and
              delivered to your private dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link href="/esims">
                  Buy a travel eSIM <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5">
                <Link href="/verification">Get a verification number</Link>
              </Button>
            </div>
          </div>

          {/* Destination search card, styled like a boarding pass */}
          <div className="relative">
            <div className="rounded-2xl border bg-card shadow-xl shadow-primary/5">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Where are you going?</p>
                <Globe2 className="size-4 text-brand" aria-hidden />
              </div>
              <form action="/esims" method="get" role="search" className="space-y-4 p-6">
                <label htmlFor="hero-dest" className="text-sm font-medium">
                  Destination
                </label>
                <input
                  id="hero-dest"
                  name="q"
                  type="search"
                  placeholder="Country or region, e.g. Spain"
                  autoComplete="off"
                  maxLength={80}
                  className="h-12 w-full rounded-lg border bg-background px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button type="submit" className="h-11 w-full">
                  Find eSIM plans
                </Button>
              </form>
              <div className="relative border-t border-dashed px-6 py-4">
                <span aria-hidden className="absolute -left-3 -top-3 size-6 rounded-full border bg-background" />
                <span aria-hidden className="absolute -right-3 -top-3 size-6 rounded-full border bg-background" />
                <p className="text-xs text-muted-foreground">
                  {destinations.length > 0
                    ? `${destinations.length} destinations available from our supplier right now.`
                    : "Destinations load live from our supplier."}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured destinations */}
      {featured.length > 0 && (
        <section aria-labelledby="featured" className="py-16">
          <Container>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="featured" className="text-2xl font-semibold">Popular eSIM destinations</h2>
                <p className="mt-1 text-sm text-muted-foreground">Live plans and server-calculated prices.</p>
              </div>
              <Link href="/esims" className="hidden text-sm font-medium underline-offset-2 hover:underline sm:block">
                All destinations →
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => (
                <DestinationCard key={d.id} d={d} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Two products, explained honestly */}
      <section aria-labelledby="products" className="border-y bg-muted/40 py-16">
        <Container>
          <h2 id="products" className="text-2xl font-semibold">Two different products — know which one you need</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Smartphone className="size-5" aria-hidden /></span>
                <h3 className="text-lg font-semibold">Travel eSIM</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Mobile data in another country without buying a physical SIM. Data-only: it does <strong className="text-foreground">not</strong>{" "}
                include a phone number and cannot receive verification codes.
              </p>
              <Link href="/esims" className="mt-4 inline-flex text-sm font-medium underline underline-offset-2">Browse eSIM plans</Link>
            </article>
            <article className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary"><MessageSquareText className="size-5" aria-hidden /></span>
                <h3 className="text-lg font-semibold">Verification number</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A temporary number for receiving one SMS code from a specific service within a time limit. Need a number for longer? Choose a{" "}
                <Link href="/numbers/rentals" className="font-medium text-foreground underline underline-offset-2">rental</Link> instead.
              </p>
              {services.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Supported services">
                  {services.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs">
                      <ServiceInitial name={s.name} className="size-5 rounded-full text-[10px]" />
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/verification" className="mt-4 inline-flex text-sm font-medium underline underline-offset-2">Choose a country</Link>
            </article>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="py-16">
        <Container>
          <h2 id="how" className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: ScanLine, title: "Choose", body: "Pick a destination plan or a country and service. You see the final price and currency before paying." },
              { icon: CreditCard, title: "Pay securely", body: "Payment is verified server-side with the payment provider before anything is ordered from our supplier." },
              { icon: QrCode, title: "Receive", body: "Your eSIM QR code or phone number appears in your private dashboard, along with incoming SMS and order status." },
            ].map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-6">
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <step.icon className="mt-3 size-6 text-brand" aria-hidden />
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-6 py-5 text-sm">
            <span className="flex items-center gap-2"><Smartphone className="size-4 text-muted-foreground" aria-hidden />eSIM needs a compatible, unlocked phone.</span>
            <Link href="/device-compatibility" className="font-medium underline underline-offset-2">Check device compatibility</Link>
          </div>
        </Container>
      </section>

      {/* Trust & privacy — only implemented capabilities */}
      <section aria-labelledby="trust" className="border-y bg-primary py-16 text-primary-foreground">
        <Container>
          <h2 id="trust" className="text-2xl font-semibold">Built to protect your data and your money</h2>
          <ul className="mt-8 grid gap-6 text-sm md:grid-cols-3">
            <li>
              <Lock className="size-5 opacity-80" aria-hidden />
              <p className="mt-3 font-semibold">Private by default</p>
              <p className="mt-1 opacity-75">eSIM activation codes and SMS messages are encrypted at rest and visible only to you when signed in.</p>
            </li>
            <li>
              <CreditCard className="size-5 opacity-80" aria-hidden />
              <p className="mt-3 font-semibold">Verified payments</p>
              <p className="mt-1 opacity-75">Orders are fulfilled only after signed, server-side payment confirmation — never on a browser redirect alone.</p>
            </li>
            <li>
              <MessageSquareText className="size-5 opacity-80" aria-hidden />
              <p className="mt-3 font-semibold">Real support</p>
              <p className="mt-1 opacity-75">Open a ticket from your dashboard about any order. Every ticket is linked to the order it concerns.</p>
            </li>
          </ul>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="faq" className="text-2xl font-semibold">Questions, answered</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              More in the <Link href="/faq" className="font-medium text-foreground underline underline-offset-2">FAQ</Link> and{" "}
              <Link href="/help" className="font-medium text-foreground underline underline-offset-2">help centre</Link>.
            </p>
          </div>
          <div className="divide-y rounded-2xl border bg-card">
            {FAQ.slice(0, 5).map((item) => (
              <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
