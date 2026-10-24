import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/catalog/price";
import { ServiceInitial, StockIndicator } from "@/components/catalog/service-card";
import { EmptyState } from "@/components/common/empty-state";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
import { getVerificationService } from "@/server/catalog/queries";
import { getStorefrontStatus } from "@/server/storefront";

type Params = { country: string; service: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { country, service } = await params;
  const result = await getVerificationService(country, service);
  if (!result?.service) return { title: "Service not found" };
  return {
    title: `${result.service.name} verification number — ${result.country.name}`,
    description: `Temporary ${result.country.name} number to receive a ${result.service.name} SMS code. Live price and availability.`,
    alternates: { canonical: `/verification/${result.country.slug}/${result.service.slug}` },
  };
}

export default async function VerificationServicePage({ params }: { params: Promise<Params> }) {
  const { country, service: serviceSlug } = await params;
  const [result, status] = await Promise.all([getVerificationService(country, serviceSlug), getStorefrontStatus()]);
  if (!result?.service) notFound();
  const { service } = result;
  const purchasable = status.purchasesEnabled && status.paymentsConfigured && status.supplierConfigured;

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/verification" className="hover:text-foreground">Verification numbers</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/verification/${result.country.slug}`} className="hover:text-foreground">{result.country.name}</Link>{" "}
        <span aria-hidden>/</span> <span className="text-foreground">{service.name}</span>
      </nav>

      <div className="flex items-center gap-4">
        <ServiceInitial name={service.name} className="size-12 text-lg" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Step 3 of 3 · Choose a route</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {service.name} · {flagEmoji(result.country.code)} {result.country.name}
          </h1>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="routes">
          <h2 id="routes" className="sr-only">Available routes</h2>
          {service.offers.length === 0 ? (
            <EmptyState title="No routes available" description="Try again in a few minutes or choose another country." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Route</th>
                    <th scope="col" className="px-4 py-3 font-medium">Reported delivery rate</th>
                    <th scope="col" className="px-4 py-3 font-medium">Stock</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {service.offers.map((o, i) => {
                    const canBuy = purchasable && !!o.price && (o.stock ?? 0) > 0;
                    return (
                      <tr key={o.productId}>
                        <td className="px-4 py-3">
                          <p className="font-medium">Route {String.fromCharCode(65 + i)}</p>
                          <p className="text-xs text-muted-foreground">{o.providerTier} · {o.operator}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{o.deliverability !== null ? `${o.deliverability}%` : "—"}</td>
                        <td className="px-4 py-3"><StockIndicator stock={o.stock ?? 0} /></td>
                        <td className="px-4 py-3 text-right"><Price value={o.price} /></td>
                        <td className="px-4 py-3 text-right">
                          {canBuy ? (
                            <Button asChild size="sm"><Link href={`/checkout?product=${o.productId}`}>Buy</Link></Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled>Unavailable</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Delivery rates are reported by the supplier and are not a guarantee. Prices refreshed {formatRelative(result.country.offersSyncedAt)};
            the price is re-checked with the supplier at checkout.
          </p>
        </section>

        <aside className="space-y-3 text-sm">
          <div className="flex gap-3 rounded-xl border bg-card p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">
              Each number is valid for a limited time set by the supplier. The exact expiry is shown in your dashboard as soon as the number
              is issued.
            </p>
          </div>
          <div className="flex gap-3 rounded-xl border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">
              If no SMS arrives and the supplier refunds the activation, we refund you automatically to your original payment method.
            </p>
          </div>
          <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>
              Use numbers only where the service’s own rules allow it. Never use them for fraud, impersonation or to evade identity
              checks. See our <Link href="/acceptable-use" className="font-medium underline underline-offset-2">acceptable use policy</Link>.
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
