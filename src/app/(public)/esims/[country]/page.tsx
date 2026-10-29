import { Check, Clock, PackageX, QrCode, Settings, Smartphone, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataOnlyNotice } from "@/components/catalog/capabilities";
import { PlanCard } from "@/components/catalog/plan-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { Flag } from "@/components/common/flag";
import { Container } from "@/components/common/page-header";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEsimDestination } from "@/server/catalog/queries";
import { dec } from "@/server/pricing/money";
import { HeaderBand } from "@/components/common/header-band";

type Params = { country: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { country } = await params;
  const result = await getEsimDestination(country);
  if (!result) return { title: "Destination not found" };
  return {
    title: `${result.destination.name} eSIM data plans`,
    description: `Compare prepaid eSIM data plans for ${result.destination.name}: data allowance, validity, network speed and final price.`,
    alternates: { canonical: `/esims/${result.destination.slug}` },
  };
}

const SORTS = [
  { value: "price", label: "Lowest price" },
  { value: "data", label: "Most data" },
  { value: "validity", label: "Longest validity" },
] as const;

const KIND_LABEL = { COUNTRY: "Country plan", REGION: "Regional plan", GLOBAL: "Global plan" } as const;

const INSTALL_PREVIEW = [
  { icon: Wifi, text: "Connect to Wi-Fi before you travel." },
  { icon: Settings, text: "Open Settings › Mobile/Cellular › Add eSIM." },
  { icon: QrCode, text: "Scan the QR code from your dashboard." },
  { icon: Smartphone, text: "On arrival, turn on data roaming for the eSIM line." },
];

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ country }, sp] = await Promise.all([params, searchParams]);
  const result = await getEsimDestination(country);
  if (!result) notFound();
  const { destination, plans } = result;

  const sort = typeof sp.sort === "string" && SORTS.some((s) => s.value === sp.sort) ? sp.sort : "price";
  const sorted = [...plans].sort((a, b) => {
    if (sort === "data") return Number(BigInt(b.dataVolumeBytes ?? "0") - BigInt(a.dataVolumeBytes ?? "0"));
    if (sort === "validity") return (b.validityDays ?? 0) - (a.validityDays ?? 0);
    if (!a.price) return 1;
    if (!b.price) return -1;
    return dec(a.price.amount).cmp(dec(b.price.amount));
  });
  const speeds = [...new Set(plans.map((p) => p.speed).filter(Boolean))];

  return (
    <>
      <HeaderBand>
        <Container className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Travel eSIMs", href: "/esims" }, { label: destination.name }]} />
          <div className="mt-6 flex items-center gap-3">
            <Flag code={destination.country?.code} kind={destination.kind} size="lg" />
            <span className="eyebrow">{KIND_LABEL[destination.kind]}</span>
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{destination.name} eSIM</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {plans.length} prepaid data plan{plans.length === 1 ? "" : "s"} for {destination.name}, delivered as a QR code to your
            dashboard after payment.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
            <li className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-card">
              <QrCode className="size-3.5 text-primary" aria-hidden /> QR code delivery
            </li>
            {speeds.length > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-card">
                <Wifi className="size-3.5 text-primary" aria-hidden /> {speeds.join(" · ")}
              </li>
            )}
            <li className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-card">
              <Smartphone className="size-3.5 text-primary" aria-hidden /> Data only · no phone number
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-card">
              <Clock className="size-3.5 text-primary" aria-hidden /> Prices updated {formatRelative(destination.packagesSyncedAt)}
            </li>
          </ul>
        </Container>
      </HeaderBand>

      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="plans" className="surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="plans" className="text-xl font-semibold">
                Select a data plan
              </h2>
              <p className="text-sm text-muted-foreground">Final price shown before checkout. No roaming charges from us.</p>
            </div>
            <nav aria-label="Sort plans" className="flex gap-1 rounded-[10px] bg-muted p-1">
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={`/esims/${destination.slug}?sort=${s.value}`}
                  aria-current={sort === s.value ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm",
                    sort === s.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={PackageX}
              title="No plans available for this destination right now"
              description="Inventory changes frequently. Try again later or choose a regional plan."
              action={
                <Link href="/esims?kind=REGION" className="text-sm font-medium text-primary underline">
                  See regional plans
                </Link>
              }
            />
          ) : (
            <div className="mt-5 space-y-3">
              {sorted.map((plan) => (
                <PlanCard key={plan.id} plan={plan} destinationSlug={destination.slug} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="font-semibold">Before you buy</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {[
                "Your phone must support eSIM and be unlocked by your carrier.",
                "Most eSIM profiles can be installed only once, so keep it after installing.",
                "Validity may start at installation or first use, depending on the network.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/device-compatibility" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
              Check your phone supports eSIM
            </Link>
          </div>
          <div className="surface p-5">
            <p className="eyebrow">Setup preview</p>
            <h2 className="mt-1 font-semibold">Installing takes a few minutes</h2>
            <ol className="mt-4 space-y-3">
              {INSTALL_PREVIEW.map((step, i) => (
                <li key={step.text} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-muted-foreground">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </Container>

      <Container>
        <DataOnlyNotice />
      </Container>
    </>
  );
}
