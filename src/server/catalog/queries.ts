import "server-only";
import type { DestinationKind, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { createPricingSession, type PricingSession } from "@/server/pricing/service";
import { dec } from "@/server/pricing/money";
import {
  ensureEsimDestinations,
  ensureEsimPackages,
  ensureRentalCountries,
  ensureRentalOffers,
  ensureVerificationCatalog,
  ensureVerificationOffers,
} from "./freshness";

/**
 * Public catalogue read models. Prices are computed on the server from supplier cost and
 * pricing rules; products that cannot be priced (no rule / no exchange rate) are shown
 * as unavailable rather than with a guessed price.
 */

export interface PricedAmount {
  amount: string;
  currency: string;
}

const productPricingSelect = {
  id: true,
  type: true,
  wholesaleCost: true,
  wholesaleCurrency: true,
  countryId: true,
  destinationId: true,
  serviceId: true,
} satisfies Prisma.ProductSelect;

function priceOf(session: PricingSession, product: Prisma.ProductGetPayload<{ select: typeof productPricingSelect }>): PricedAmount | null {
  const b = session.tryPrice(product);
  return b ? { amount: b.unitPrice, currency: b.currency } : null;
}

function minPrice(prices: Array<PricedAmount | null>): PricedAmount | null {
  let best: PricedAmount | null = null;
  for (const p of prices) {
    if (p && (!best || dec(p.amount).lt(dec(best.amount)))) best = p;
  }
  return best;
}

// ───────────── eSIM ─────────────

export interface DestinationCard {
  id: string;
  slug: string;
  name: string;
  locationCode: string;
  kind: DestinationKind;
  countryCode: string | null;
  packageCount: number;
  topSpeed: string | null;
  fromPrice: PricedAmount | null;
}

export async function listEsimDestinations(opts: { q?: string; kind?: DestinationKind } = {}): Promise<DestinationCard[]> {
  await ensureEsimDestinations();
  const [destinations, session] = await Promise.all([
    db.esimDestination.findMany({
      where: {
        isActive: true,
        isEnabled: true,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}),
      },
      include: { country: { select: { code: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    createPricingSession(),
  ]);
  const products = await db.product.findMany({
    where: { type: "ESIM", isActive: true, isVisible: true, destinationId: { in: destinations.map((d) => d.id) } },
    select: productPricingSelect,
  });
  const byDest = new Map<string, Array<PricedAmount | null>>();
  for (const p of products) {
    const list = byDest.get(p.destinationId!) ?? [];
    list.push(priceOf(session, p));
    byDest.set(p.destinationId!, list);
  }
  return destinations.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    locationCode: d.locationCode,
    kind: d.kind,
    countryCode: d.country?.code ?? null,
    packageCount: d.packageCount,
    topSpeed: d.topSpeed,
    fromPrice: minPrice(byDest.get(d.id) ?? []),
  }));
}

export interface EsimPlanCard {
  id: string;
  slug: string;
  name: string;
  dataLabel: string | null;
  dataVolumeBytes: string | null;
  validityDays: number | null;
  unlimited: boolean;
  pricingUnit: string | null;
  speed: string | null;
  fupPolicy: string | null;
  ipExport: string | null;
  includesPhoneNumber: boolean;
  includesSms: boolean;
  includesVoice: boolean;
  price: PricedAmount | null;
  lastSyncedAt: Date;
}

function toPlanCard(
  p: Prisma.ProductGetPayload<{ select: typeof planSelect }>,
  session: PricingSession,
): EsimPlanCard {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    dataLabel: p.dataLabel,
    dataVolumeBytes: p.dataVolumeBytes?.toString() ?? null,
    validityDays: p.validityDays,
    unlimited: p.unlimited,
    pricingUnit: p.pricingUnit,
    speed: p.speed,
    fupPolicy: p.fupPolicy,
    ipExport: p.ipExport,
    includesPhoneNumber: p.includesPhoneNumber,
    includesSms: p.includesSms,
    includesVoice: p.includesVoice,
    price: priceOf(session, p),
    lastSyncedAt: p.lastSyncedAt,
  };
}

const planSelect = {
  ...productPricingSelect,
  slug: true,
  name: true,
  dataLabel: true,
  dataVolumeBytes: true,
  validityDays: true,
  unlimited: true,
  pricingUnit: true,
  speed: true,
  fupPolicy: true,
  ipExport: true,
  includesPhoneNumber: true,
  includesSms: true,
  includesVoice: true,
  lastSyncedAt: true,
} satisfies Prisma.ProductSelect;

export async function getEsimDestination(slug: string) {
  const destination = await db.esimDestination.findFirst({
    where: { slug, isEnabled: true },
    include: { country: { select: { code: true, name: true } } },
  });
  if (!destination) return null;
  await ensureEsimPackages(destination);
  const [products, session] = await Promise.all([
    db.product.findMany({
      where: { type: "ESIM", destinationId: destination.id, isActive: true, isVisible: true },
      select: planSelect,
      orderBy: [{ unlimited: "asc" }, { dataVolumeBytes: "asc" }, { validityDays: "asc" }],
    }),
    createPricingSession(),
  ]);
  const fresh = await db.esimDestination.findUniqueOrThrow({ where: { id: destination.id }, select: { packagesSyncedAt: true } });
  return {
    destination: { ...destination, packagesSyncedAt: fresh.packagesSyncedAt },
    plans: products.map((p) => toPlanCard(p, session)),
  };
}

export async function getEsimPlan(destinationSlug: string, planSlug: string) {
  const result = await getEsimDestination(destinationSlug);
  if (!result) return null;
  const plan = result.plans.find((p) => p.slug === planSlug);
  if (!plan) return null;
  return { destination: result.destination, plan, related: result.plans.filter((p) => p.id !== plan.id).slice(0, 4) };
}

// ───────────── Verification ─────────────

export interface VerificationCountryCard {
  id: string;
  code: string;
  slug: string;
  name: string;
  phoneCode: string | null;
  continent: string | null;
}

export async function listVerificationCountries(q?: string): Promise<VerificationCountryCard[]> {
  await ensureVerificationCatalog();
  return db.country.findMany({
    where: { isEnabled: true, hasVerification: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, code: true, slug: true, name: true, phoneCode: true, continent: true },
    orderBy: { name: "asc" },
  });
}

export async function listPopularServices(limit = 12) {
  await ensureVerificationCatalog();
  return db.service.findMany({
    where: { isActive: true, isEnabled: true },
    orderBy: [{ popular: "desc" }, { name: "asc" }],
    take: limit,
    select: { id: true, slug: true, name: true, iconUrl: true, popular: true },
  });
}

export interface VerificationOfferView {
  productId: string;
  providerTier: string | null;
  operator: string | null;
  stock: number | null;
  deliverability: number | null;
  price: PricedAmount | null;
}

export interface ServiceOffersView {
  serviceId: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  popular: boolean;
  fromPrice: PricedAmount | null;
  totalStock: number;
  offers: VerificationOfferView[];
}

const offerSelect = {
  ...productPricingSelect,
  providerTier: true,
  operator: true,
  stockCount: true,
  deliverability: true,
  service: { select: { id: true, slug: true, name: true, iconUrl: true, popular: true, isEnabled: true } },
} satisfies Prisma.ProductSelect;

export async function getVerificationCountry(slug: string) {
  const country = await db.country.findFirst({ where: { slug, isEnabled: true } });
  if (!country) return null;
  await ensureVerificationOffers(country);
  const [products, session, refreshed] = await Promise.all([
    db.product.findMany({
      where: { type: "VERIFICATION", countryId: country.id, isActive: true, isVisible: true, service: { isEnabled: true, isActive: true } },
      select: offerSelect,
    }),
    createPricingSession(),
    db.country.findUniqueOrThrow({ where: { id: country.id }, select: { offersSyncedAt: true } }),
  ]);

  const grouped = new Map<string, ServiceOffersView>();
  for (const p of products) {
    if (!p.service) continue;
    const view: VerificationOfferView = {
      productId: p.id,
      providerTier: p.providerTier,
      operator: p.operator,
      stock: p.stockCount,
      deliverability: p.deliverability,
      price: priceOf(session, p),
    };
    const g = grouped.get(p.service.id) ?? {
      serviceId: p.service.id,
      slug: p.service.slug,
      name: p.service.name,
      iconUrl: p.service.iconUrl,
      popular: p.service.popular,
      fromPrice: null,
      totalStock: 0,
      offers: [],
    };
    g.offers.push(view);
    g.totalStock += p.stockCount ?? 0;
    g.fromPrice = minPrice([g.fromPrice, view.price]);
    grouped.set(p.service.id, g);
  }
  const services = [...grouped.values()]
    .map((s) => ({ ...s, offers: s.offers.sort((a, b) => (a.price && b.price ? dec(a.price.amount).cmp(dec(b.price.amount)) : 0)) }))
    .sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name));
  return { country: { ...country, offersSyncedAt: refreshed.offersSyncedAt }, services };
}

export async function getVerificationService(countrySlug: string, serviceSlug: string) {
  const result = await getVerificationCountry(countrySlug);
  if (!result) return null;
  const service = result.services.find((s) => s.slug === serviceSlug);
  if (!service) return { country: result.country, service: null };
  return { country: result.country, service };
}

// ───────────── Rentals ─────────────

export async function listRentalCountries() {
  await ensureRentalCountries();
  return db.country.findMany({
    where: { isEnabled: true, hasRentals: true },
    select: { id: true, code: true, slug: true, name: true, phoneCode: true },
    orderBy: { name: "asc" },
  });
}

export interface RentalOfferView {
  productId: string;
  rentalType: string | null;
  term: string | null;
  durationHours: number | null;
  serviceName: string | null;
  price: PricedAmount | null;
}

export async function getRentalOffers(countryCode: string): Promise<RentalOfferView[]> {
  await ensureRentalOffers(countryCode);
  const country = await db.country.findUnique({ where: { code: countryCode.toUpperCase() } });
  if (!country) return [];
  const [products, session] = await Promise.all([
    db.product.findMany({
      where: { type: "RENTAL", countryId: country.id, isActive: true, isVisible: true },
      select: { ...productPricingSelect, rentalType: true, rentalTerm: true, durationHours: true, service: { select: { name: true } } },
      orderBy: [{ rentalType: "asc" }, { durationHours: "asc" }],
    }),
    createPricingSession(),
  ]);
  return products.map((p) => ({
    productId: p.id,
    rentalType: p.rentalType,
    term: p.rentalTerm,
    durationHours: p.durationHours,
    serviceName: p.service?.name ?? null,
    price: priceOf(session, p),
  }));
}
