import { CalendarDays, Check, Database, Gauge, Globe2, Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CapabilityBadges, DataOnlyNotice } from "@/components/catalog/capabilities";
import { PlanCard } from "@/components/catalog/plan-card";
import { Price } from "@/components/catalog/price";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
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
    title: `${result.plan.name} — ${result.destination.name} eSIM`,
    description: `${result.plan.dataLabel ?? "Data"} for ${result.destination.name}, valid ${formatValidity(result.plan.validityDays)}. Data-only travel eSIM.`,
    alternates: { canonical: `/esims/${result.destination.slug}/${result.plan.slug}` },
  };
}

export default async function PlanPage({ params }: { params: Promise<Params> }) {
  const { country, plan: planSlug } = await params;
  const [result, status] = await Promise.all([getEsimPlan(country, planSlug), getStorefrontStatus()]);
  if (!result) notFound();
  const { destination, plan, related } = result;
  const perDay = plan.pricingUnit === "per_day";
  const canBuy = !!plan.price && status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  const facts = [
    { icon: Database, label: "Data", value: plan.dataLabel ?? formatBytes(plan.dataVolumeBytes ? BigInt(plan.dataVolumeBytes) : null) },
    { icon: CalendarDays, label: "Validity", value: perDay ? "Per day, choose 1–365 days" : formatValidity(plan.validityDays) },
    { icon: Gauge, label: "Network", value: plan.speed ?? "Not specified by supplier" },
    { icon: Globe2, label: "Coverage", value: destination.name },
  ];

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/esims" className="hover:text-foreground">
          Travel eSIMs
        </Link>{" "}
        <span aria-hidden>/</span>{" "}
        <Link href={`/esims/${destination.slug}`} className="hover:text-foreground">
          {destination.name}
        </Link>{" "}
        <span aria-hidden>/</span> <span className="text-foreground">{plan.dataLabel ?? plan.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">{plan.name}</h1>
            <CapabilityBadges
              includesPhoneNumber={plan.includesPhoneNumber}
              includesSms={plan.includesSms}
              includesVoice={plan.includesVoice}
            />
          </div>

          <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-3 bg-card p-4">
                <f.icon className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 font-medium">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section aria-labelledby="before-you-buy" className="space-y-3">
            <h2 id="before-you-buy" className="text-lg font-semibold">
              Before you buy
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Your phone must support eSIM and be carrier-unlocked.
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
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Fair use: {plan.fupPolicy}.
                </li>
              )}
              {plan.ipExport && (
                <li className="flex gap-2">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Internet traffic exits via {plan.ipExport} (affects which local sites and apps you see).
                </li>
              )}
              <li className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Activation and validity rules are set by the network; the validity period may start at installation or first use.
              </li>
            </ul>
            <p className="text-sm">
              See our{" "}
              <Link href="/refund-policy" className="font-medium underline underline-offset-2">
                refund policy
              </Link>{" "}
              and{" "}
              <Link href="/device-compatibility" className="font-medium underline underline-offset-2">
                device compatibility guide
              </Link>
              .
            </p>
          </section>

          <DataOnlyNotice />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">{perDay ? "Price per day" : "Total price"}</p>
            <Price
              value={plan.price}
              suffix={perDay ? "/day" : undefined}
              className="mt-1 block text-4xl tracking-tight"
              unavailableLabel="Not available"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Charged in {status.currency}. Taxes, if applicable, are shown at checkout. Updated {formatRelative(plan.lastSyncedAt)}.
            </p>
            {canBuy ? (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={`/checkout?product=${plan.id}`}>Continue to checkout</Link>
              </Button>
            ) : (
              <Button size="lg" className="mt-6 w-full" disabled>
                Unavailable
              </Button>
            )}
            {!canBuy && (
              <p className="mt-3 text-xs text-muted-foreground">
                {!plan.price ? "This plan cannot be priced right now." : "Purchases are temporarily unavailable."}
              </p>
            )}
            <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Your eSIM is issued only after the payment is verified on our server. Activation details are shown in your private
              dashboard and are never sent in email subject lines.
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-16">
          <h2 id="related" className="mb-4 text-lg font-semibold">
            Other {destination.name} plans
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <PlanCard key={p.id} plan={p} destinationSlug={destination.slug} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
