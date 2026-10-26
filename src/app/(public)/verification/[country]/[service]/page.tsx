import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/catalog/price";
import { ServiceInitial, StockIndicator } from "@/components/catalog/service-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { getVerificationService } from "@/server/catalog/queries";
import { getStorefrontStatus } from "@/server/storefront";

type Params = { country: string; service: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { country, service } = await params;
  const result = await getVerificationService(country, service);
  if (!result?.service) return { title: "Service not found" };
  return {
    title: `${result.service.name} verification number · ${result.country.name}`,
    description: `Temporary ${result.country.name} number to receive a ${result.service.name} SMS code. Live price and availability.`,
    alternates: { canonical: `/verification/${result.country.slug}/${result.service.slug}` },
  };
}

/** Supplier-reported delivery rate (a percentage) as a bar; a dash when none is reported. */
function DeliveryRate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">Not reported</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs font-semibold text-success tabular-nums">{pct}%</span>
    </span>
  );
}

export default async function VerificationServicePage({ params }: { params: Promise<Params> }) {
  const { country, service: serviceSlug } = await params;
  const [result, status] = await Promise.all([getVerificationService(country, serviceSlug), getStorefrontStatus()]);
  if (!result?.service) notFound();
  const { service } = result;
  const purchasable = status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  return (
    <>
      <section className="border-b bg-linear-to-b from-accent/70 to-background">
        <Container className="py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Verification numbers", href: "/verification" },
              { label: result.country.name, href: `/verification/${result.country.slug}` },
              { label: service.name },
            ]}
          />
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-accent-foreground shadow-card">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Step 3 of 3 · Choose a route
          </p>
          <div className="mt-4 flex items-center gap-4">
            <ServiceInitial name={service.name} className="size-12 rounded-xl text-lg" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{service.name} verification</h1>
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Flag code={result.country.code} />
                {result.country.name}
                {result.country.phoneCode && <span className="text-sm">({result.country.phoneCode})</span>}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="routes">
          <div className="surface overflow-hidden">
            <div className="border-b p-5">
              <h2 id="routes" className="text-lg font-semibold">
                Available routes
              </h2>
              <p className="text-sm text-muted-foreground">Each route is a different supplier pool for {result.country.name} numbers.</p>
            </div>
            {service.offers.length === 0 ? (
              <EmptyState className="m-5" title="No routes available" description="Try again in a few minutes or choose another country." />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b bg-muted text-left text-xs tracking-[0.06em] text-muted-foreground uppercase">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Route
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Reported delivery
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Stock
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Price
                      </th>
                      <th scope="col" className="px-5 py-3">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {service.offers.map((o, i) => {
                      const canBuy = purchasable && !!o.price && (o.stock ?? 0) > 0;
                      return (
                        <tr key={o.productId} className="transition-colors hover:bg-accent/40">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold">Route {String.fromCharCode(65 + i)}</p>
                            <p className="text-xs text-muted-foreground">
                              {o.providerTier} · {o.operator}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <DeliveryRate value={o.deliverability} />
                          </td>
                          <td className="px-5 py-3.5">
                            <StockIndicator stock={o.stock ?? 0} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Price value={o.price} className="text-foreground" />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canBuy ? (
                              <Button asChild className="h-9 px-4">
                                <Link href={`/checkout?product=${o.productId}`}>Buy</Link>
                              </Button>
                            ) : (
                              <Button variant="secondary" className="h-9" disabled>
                                Unavailable
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Delivery rates are reported by the supplier and are not a guarantee. Prices refreshed {formatRelative(result.country.offersSyncedAt)}; the
            price is checked again with the supplier at checkout.
          </p>
        </section>

        <aside className="space-y-4 text-sm lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5 shadow-float">
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Your selection</p>
            <p className="mt-2 flex items-center gap-2 font-semibold">
              <Flag code={result.country.code} />
              {result.country.name}
              <span className="text-primary">· {service.name}</span>
            </p>
            <div className="mt-4 flex items-end justify-between border-t pt-4">
              <span className="text-muted-foreground">From</span>
              <Price value={service.fromPrice} className="text-2xl text-foreground" unavailableLabel="Unavailable" />
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border bg-card p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-muted-foreground">
              Each number is valid for a limited time set by the supplier. The exact expiry is shown in your dashboard as soon as the number is
              issued.
            </p>
          </div>
          <div className="flex gap-3 rounded-2xl border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <p className="text-muted-foreground">
              If no SMS arrives and the supplier refunds the activation, we refund you automatically to your original payment method.
            </p>
          </div>
          <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>
              Use numbers only where the service’s own rules allow it. Never use them for fraud, impersonation or to evade identity checks. See our{" "}
              <Link href="/acceptable-use" className="font-medium underline underline-offset-2">
                acceptable use policy
              </Link>
              .
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
