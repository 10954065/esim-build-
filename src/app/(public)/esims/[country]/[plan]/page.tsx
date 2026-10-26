import { CalendarDays, Check, Database, Gauge, Globe2, Info, Lock, Plane, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CapabilityBadges, DataOnlyNotice } from "@/components/catalog/capabilities";
import { PlanCard } from "@/components/catalog/plan-card";
import { Price } from "@/components/catalog/price";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/currency";
import { formatRelative, formatValidity } from "@/lib/format";
import { getEsimPlan } from "@/server/catalog/queries";
import { getStorefrontStatus } from "@/server/storefront";

type Params = { country: string; plan: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { country, plan } = await params;
  const result = await getEsimPlan(country, plan);
  if (!result) return { title: "Plan not found" };
  return {
    title: `${result.plan.name} · ${result.destination.name} eSIM`,
    description: `${result.plan.dataLabel ?? "Data"} for ${result.destination.name}, valid ${formatValidity(result.plan.validityDays)}. Data only travel eSIM.`,
    alternates: { canonical: `/esims/${result.destination.slug}/${result.plan.slug}` },
  };
}

const INSTALL_STEPS = {
  ios: [
    { title: "Open Settings", body: "Connect to Wi-Fi, then go to Settings › Mobile Service (or Cellular) › Add eSIM." },
    { title: "Scan the QR code", body: "Choose ‘Use QR Code’ and scan the code shown in your Roamwell dashboard." },
    { title: "Label the line", body: "Name it ‘Travel data’ and keep your usual SIM as the primary line for calls and SMS." },
    { title: "Turn on roaming", body: "On arrival, select the travel line for mobile data and switch on data roaming for it." },
  ],
  android: [
    { title: "Open Settings", body: "Connect to Wi-Fi, then go to Settings › Network & internet › SIMs › Add eSIM." },
    { title: "Scan the QR code", body: "Choose ‘Download a SIM instead?’ or ‘Scan QR code’ and scan the code from your dashboard." },
    { title: "Name the line", body: "Rename it ‘Travel data’. Keep your usual SIM on for calls and SMS if you want them." },
    { title: "Turn on roaming", body: "On arrival, set the travel eSIM as the mobile-data SIM and enable roaming for it." },
  ],
};

export default async function PlanPage({ params }: { params: Promise<Params> }) {
  const { country, plan: planSlug } = await params;
  const [result, status] = await Promise.all([getEsimPlan(country, planSlug), getStorefrontStatus()]);
  if (!result) notFound();
  const { destination, plan, related } = result;
  const perDay = plan.pricingUnit === "per_day";
  const canBuy = !!plan.price && status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  const facts = [
    { icon: Database, label: "Data allowance", value: plan.dataLabel ?? formatBytes(plan.dataVolumeBytes ? BigInt(plan.dataVolumeBytes) : null) },
    { icon: CalendarDays, label: "Validity", value: perDay ? "Per day, choose 1 to 365 days" : formatValidity(plan.validityDays) },
    { icon: Gauge, label: "Network", value: plan.speed ?? "Not specified by supplier" },
    { icon: Globe2, label: "Coverage", value: destination.name },
  ];

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Travel eSIMs", href: "/esims" },
              { label: destination.name, href: `/esims/${destination.slug}` },
              { label: plan.dataLabel ?? plan.name },
            ]}
          />
          <div className="mt-6 flex items-center gap-3">
            <Flag code={destination.country?.code} kind={destination.kind} size="lg" />
            <span className="eyebrow">{destination.name} eSIM</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{plan.name}</h1>
          <div className="mt-4">
            <CapabilityBadges includesPhoneNumber={plan.includesPhoneNumber} includesSms={plan.includesSms} includesVoice={plan.includesVoice} />
          </div>
        </Container>
      </section>

      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section aria-labelledby="specs" className="surface p-5 sm:p-6">
            <h2 id="specs" className="text-lg font-semibold">
              Plan details
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl border bg-background p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    <f.icon className="size-4 text-primary" aria-hidden />
                    {f.label}
                  </dt>
                  <dd className="mt-1.5 font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-8 font-semibold">Before you buy</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Your phone must support eSIM and be unlocked by your carrier.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                You install the eSIM by scanning a QR code or entering activation details shown in your dashboard after payment.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Most eSIM profiles can be installed only once. Do not delete it from your phone after installing.
              </li>
              {plan.fupPolicy && (
                <li className="flex gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  Fair use: {plan.fupPolicy}.
                </li>
              )}
              {plan.ipExport && (
                <li className="flex gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  Internet traffic exits via {plan.ipExport} (affects which local sites and apps you see).
                </li>
              )}
              <li className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Activation and validity rules are set by the network; the validity period may start at installation or first use.
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              See our{" "}
              <Link href="/refund-policy" className="font-medium text-primary hover:underline">
                refund policy
              </Link>{" "}
              and{" "}
              <Link href="/device-compatibility" className="font-medium text-primary hover:underline">
                device compatibility guide
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="install" className="surface p-5 sm:p-6">
            <p className="eyebrow">Setup walkthrough</p>
            <h2 id="install" className="mt-1 text-lg font-semibold">
              How you will install it
            </h2>
            <Tabs defaultValue="ios" className="mt-4 gap-4">
              <TabsList className="h-auto gap-1 rounded-[10px] bg-muted p-1">
                <TabsTrigger value="ios" className="h-9 rounded-md px-4 data-[state=active]:bg-card data-[state=active]:shadow-card">
                  iPhone
                </TabsTrigger>
                <TabsTrigger value="android" className="h-9 rounded-md px-4 data-[state=active]:bg-card data-[state=active]:shadow-card">
                  Android
                </TabsTrigger>
              </TabsList>
              {(Object.keys(INSTALL_STEPS) as Array<keyof typeof INSTALL_STEPS>).map((os) => (
                <TabsContent key={os} value={os}>
                  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {INSTALL_STEPS[os].map((step, i) => (
                      <li key={step.title} className="rounded-xl border bg-background p-4">
                        <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                        <p className="mt-3 text-sm font-semibold">{step.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                      </li>
                    ))}
                  </ol>
                </TabsContent>
              ))}
            </Tabs>
          </section>

          <DataOnlyNotice />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border bg-card shadow-float">
            <div className="relative isolate overflow-hidden bg-ink px-6 pt-5 pb-6 text-ink-foreground">
              <div aria-hidden className="grid-lines absolute inset-0 -z-10 opacity-80" />
              <div aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-primary/50 blur-3xl" />
              <p className="flex items-center justify-between text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
                <span>Order summary</span>
                <span className="inline-flex items-center gap-1.5">
                  <Plane className="size-3.5 text-mint" aria-hidden /> Travel eSIM
                </span>
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">Destination</p>
                  <p className="truncate font-heading text-2xl font-bold">{destination.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Flag code={destination.country?.code} kind={destination.kind} size="md" />
                  <span className="font-mono text-3xl font-semibold tracking-widest">
                    {destination.kind === "COUNTRY" ? (destination.country?.code ?? "") : destination.kind === "REGION" ? "REG" : "GLB"}
                  </span>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 px-6 py-5 text-sm">
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Data</dt>
                <dd className="mt-1 truncate font-heading text-base font-semibold">{plan.dataLabel ?? plan.name}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Validity</dt>
                <dd className="mt-1 font-heading text-base font-semibold">{perDay ? "Per day" : formatValidity(plan.validityDays)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Network</dt>
                <dd className="mt-1 font-heading text-base font-semibold">{plan.speed ?? "Not specified"}</dd>
              </div>
            </dl>
            <div aria-hidden className="relative border-t-2 border-dashed">
              <span className="absolute -top-3 -left-3 size-6 rounded-full border bg-background" />
              <span className="absolute -top-3 -right-3 size-6 rounded-full border bg-background" />
            </div>
            <div className="px-6 pt-5 pb-6">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm text-muted-foreground">{perDay ? "Price per day" : "Total price"}</p>
              <Price value={plan.price} suffix={perDay ? "/day" : undefined} className="font-heading text-4xl tracking-tight" unavailableLabel="Not available" />
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">
              Charged in {status.currency}. Updated {formatRelative(plan.lastSyncedAt)}.
            </p>
            {canBuy ? (
              <Button asChild className="mt-6 h-12 w-full text-base">
                <Link href={`/checkout?product=${plan.id}`}>Continue to checkout</Link>
              </Button>
            ) : (
              <Button className="mt-6 h-12 w-full text-base" disabled>
                Unavailable
              </Button>
            )}
            {!canBuy && (
              <p className="mt-3 text-xs text-muted-foreground">
                {!plan.price ? "This plan cannot be priced right now." : "Purchases are temporarily unavailable."}
              </p>
            )}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden /> Secure checkout · payment verified on our server
            </p>
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Your eSIM is issued only after the payment is verified. Activation details are shown in your private dashboard and are never
              sent in email subject lines.
            </div>
            </div>
          </div>
        </aside>
      </Container>

      {related.length > 0 && (
        <Container>
          <section aria-labelledby="related" className="surface p-5 sm:p-6">
            <h2 id="related" className="text-lg font-semibold">
              Other {destination.name} plans
            </h2>
            <div className="mt-4 space-y-3">
              {related.map((p) => (
                <PlanCard key={p.id} plan={p} destinationSlug={destination.slug} />
              ))}
            </div>
          </section>
        </Container>
      )}
    </>
  );
}
