import { PackageX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataOnlyNotice } from "@/components/catalog/capabilities";
import { PlanCard } from "@/components/catalog/plan-card";
import { EmptyState } from "@/components/common/empty-state";
import { Container, PageHeader } from "@/components/common/page-header";
import { formatRelative } from "@/lib/format";
import { flagEmoji } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { getEsimDestination } from "@/server/catalog/queries";
import { dec } from "@/server/pricing/money";

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

  return (
    <Container className="py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/esims" className="hover:text-foreground">
          Travel eSIMs
        </Link>{" "}
        <span aria-hidden>/</span> <span className="text-foreground">{destination.name}</span>
      </nav>
      <PageHeader
        eyebrow={destination.kind === "COUNTRY" ? "Country plan" : destination.kind === "GLOBAL" ? "Global plan" : "Regional plan"}
        title={
          <span className="flex items-center gap-3">
            <span aria-hidden>{destination.kind === "COUNTRY" ? flagEmoji(destination.country?.code) : "🌐"}</span>
            {destination.name} eSIM
          </span>
        }
        description={`${plans.length} data plan${plans.length === 1 ? "" : "s"} available. Prices updated ${formatRelative(destination.packagesSyncedAt)}.`}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Sort plans" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={`/esims/${destination.slug}?sort=${s.value}`}
              aria-current={sort === s.value ? "true" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm",
                sort === s.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <Link href="/device-compatibility" className="text-sm font-medium underline underline-offset-2">
          Check your device is eSIM-compatible
        </Link>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={PackageX}
          title="No plans available for this destination right now"
          description="Inventory changes frequently. Try again later or choose a regional plan."
          action={
            <Link href="/esims?kind=REGION" className="text-sm font-medium underline">
              See regional plans
            </Link>
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((plan) => (
            <PlanCard key={plan.id} plan={plan} destinationSlug={destination.slug} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <DataOnlyNotice />
      </div>
    </Container>
  );
}
