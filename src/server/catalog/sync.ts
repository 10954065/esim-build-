import "server-only";
import type { DestinationKind, ProductType, SyncKind } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { ensureSupplierRecord, getSupplierAdapter, type SupplierAdapter } from "@/server/providers/supplier";
import type { EsimPackageInfo, RentalTermPrice, VerificationOffer } from "@/server/providers/supplier/types";
import { toDbAmount } from "@/server/pricing/money";

/**
 * Catalogue synchronisation: supplier → database. Every run writes a CatalogSyncLog.
 * Items that disappear from the supplier are deactivated (never deleted) so historic
 * orders keep their product references.
 */

const log = logger.child({ component: "catalog-sync" });

export interface SyncResult {
  upserted: number;
  deactivated: number;
}

async function withSyncLog(
  supplierId: string,
  kind: SyncKind,
  scope: string | null,
  fn: () => Promise<SyncResult>,
): Promise<SyncResult> {
  const entry = await db.catalogSyncLog.create({ data: { supplierId, kind, scope } });
  try {
    const result = await fn();
    await db.catalogSyncLog.update({
      where: { id: entry.id },
      data: { status: "SUCCESS", itemsUpserted: result.upserted, itemsDeactivated: result.deactivated, finishedAt: new Date() },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
    await db.catalogSyncLog.update({ where: { id: entry.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    log.warn("catalog sync failed", { kind, scope, err });
    throw err;
  }
}

async function context(adapter?: SupplierAdapter) {
  const a = adapter ?? getSupplierAdapter();
  const supplier = await ensureSupplierRecord(a);
  return { adapter: a, supplierId: supplier.id };
}

async function upsertCountry(
  code: string,
  name: string,
  extra: { phoneCode?: string | null; continent?: string | null; slug?: string } = {},
) {
  const upper = code.toUpperCase();
  const existing = await db.country.findUnique({ where: { code: upper } });
  if (existing) {
    return db.country.update({
      where: { id: existing.id },
      data: { phoneCode: extra.phoneCode ?? existing.phoneCode, continent: extra.continent ?? existing.continent },
    });
  }
  let slug = slugify(extra.slug ?? name);
  if (await db.country.findUnique({ where: { slug } })) slug = `${slug}-${upper.toLowerCase()}`;
  return db.country.create({
    data: { code: upper, name, slug, phoneCode: extra.phoneCode ?? null, continent: extra.continent ?? null },
  });
}

// ───────────── Verification catalogue ─────────────

export async function syncVerificationCatalog(adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);

  const countries = await withSyncLog(supplierId, "VERIFICATION_COUNTRIES", null, async () => {
    const list = await a.verification.listCountries();
    const codes: string[] = [];
    for (const c of list) {
      await upsertCountry(c.code, c.name, { phoneCode: c.phoneCode, continent: c.continent, slug: c.slug });
      codes.push(c.code.toUpperCase());
    }
    await db.country.updateMany({ where: { code: { in: codes } }, data: { hasVerification: true } });
    const off = await db.country.updateMany({
      where: { code: { notIn: codes }, hasVerification: true },
      data: { hasVerification: false },
    });
    return { upserted: codes.length, deactivated: off.count };
  });

  const services = await withSyncLog(supplierId, "VERIFICATION_SERVICES", null, async () => {
    const list = await a.verification.listServices();
    const slugs: string[] = [];
    for (const s of list) {
      await db.service.upsert({
        where: { supplierId_slug: { supplierId, slug: s.slug } },
        update: { name: s.name, iconUrl: s.iconUrl, popular: s.popular, isActive: true },
        create: { supplierId, slug: s.slug, name: s.name, iconUrl: s.iconUrl, popular: s.popular },
      });
      slugs.push(s.slug);
    }
    const off = await db.service.updateMany({
      where: { supplierId, slug: { notIn: slugs }, isActive: true },
      data: { isActive: false },
    });
    return { upserted: slugs.length, deactivated: off.count };
  });

  return { upserted: countries.upserted + services.upserted, deactivated: countries.deactivated + services.deactivated };
}

function offerCode(o: VerificationOffer): string {
  return `${o.countryCode}:${o.serviceSlug}:${o.providerTier}:${o.operator}`;
}

export async function refreshVerificationOffers(countryCode: string, adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);
  const code = countryCode.toUpperCase();
  return withSyncLog(supplierId, "VERIFICATION_PRICING", code, async () => {
    const country = await db.country.findUnique({ where: { code } });
    if (!country) throw new Error(`Unknown country ${code}`);
    const offers = await a.verification.getOffers({ countryCode: code });
    const seen: string[] = [];
    const now = new Date();

    for (const o of offers) {
      const service = await db.service.upsert({
        where: { supplierId_slug: { supplierId, slug: o.serviceSlug } },
        update: {},
        create: { supplierId, slug: o.serviceSlug, name: o.serviceName },
      });
      const supplierProductCode = offerCode(o);
      seen.push(supplierProductCode);
      const data = {
        name: `${service.name} verification · ${country.name}`,
        slug: slugify(`${o.serviceSlug}-${o.providerTier}-${o.operator}`),
        countryId: country.id,
        serviceId: service.id,
        providerTier: o.providerTier,
        operator: o.operator,
        stockCount: o.stock,
        deliverability: o.deliverability,
        wholesaleCost: toDbAmount(o.cost),
        wholesaleCurrency: a.priceCurrency,
        isActive: o.stock > 0,
        lastSyncedAt: now,
      };
      await db.product.upsert({
        where: { supplierId_type_supplierProductCode: { supplierId, type: "VERIFICATION", supplierProductCode } },
        update: data,
        create: { ...data, type: "VERIFICATION", supplierId, supplierProductCode },
      });
    }

    const off = await db.product.updateMany({
      where: { supplierId, type: "VERIFICATION", countryId: country.id, supplierProductCode: { notIn: seen }, isActive: true },
      data: { isActive: false },
    });
    await db.country.update({
      where: { id: country.id },
      data: { offersSyncedAt: now, hasVerification: offers.some((o) => o.stock > 0) },
    });
    return { upserted: seen.length, deactivated: off.count };
  });
}

// ───────────── Rentals ─────────────

export async function syncRentalCountries(adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);
  return withSyncLog(supplierId, "RENTAL_COUNTRIES", null, async () => {
    const list = await a.rentals.listRentalCountries();
    const codes: string[] = [];
    for (const c of list) {
      await upsertCountry(c.code, c.name, { phoneCode: c.phoneCode });
      codes.push(c.code.toUpperCase());
    }
    await db.country.updateMany({ where: { code: { in: codes } }, data: { hasRentals: true } });
    const off = await db.country.updateMany({ where: { code: { notIn: codes }, hasRentals: true }, data: { hasRentals: false } });
    return { upserted: codes.length, deactivated: off.count };
  });
}

export async function refreshRentalOffers(countryCode: string, adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);
  const code = countryCode.toUpperCase();
  return withSyncLog(supplierId, "RENTAL_PRICING", code, async () => {
    const country = await db.country.findUnique({ where: { code } });
    if (!country) throw new Error(`Unknown country ${code}`);
    const pricing = await a.rentals.getRentalPricing(code);
    const now = new Date();
    const seen: string[] = [];

    const upsertTerm = async (rentalType: string, term: RentalTermPrice, service: { id: string; slug: string; name: string } | null) => {
      const supplierProductCode = `${code}:${rentalType}:${service?.slug ?? "-"}:${term.term}`;
      seen.push(supplierProductCode);
      const label = service ? `${service.name} number` : "Number for all services";
      const data = {
        name: `${label} · ${country.name} · ${term.term}`,
        slug: slugify(`${rentalType}-${service?.slug ?? "all"}-${term.term}`),
        countryId: country.id,
        serviceId: service?.id ?? null,
        rentalTerm: term.term,
        rentalType,
        durationHours: term.hours ?? (term.days ? term.days * 24 : null),
        wholesaleCost: toDbAmount(term.cost),
        wholesaleCurrency: a.priceCurrency,
        isActive: true,
        lastSyncedAt: now,
      };
      await db.product.upsert({
        where: { supplierId_type_supplierProductCode: { supplierId, type: "RENTAL", supplierProductCode } },
        update: data,
        create: { ...data, type: "RENTAL", supplierId, supplierProductCode },
      });
    };

    for (const term of pricing.unlimited) await upsertTerm("unlimited", term, null);
    for (const s of pricing.services) {
      const service = await db.service.upsert({
        where: { supplierId_slug: { supplierId, slug: s.serviceSlug } },
        update: {},
        create: { supplierId, slug: s.serviceSlug, name: s.serviceName },
      });
      for (const term of s.terms) await upsertTerm("service", term, service);
    }

    const off = await db.product.updateMany({
      where: { supplierId, type: "RENTAL", countryId: country.id, supplierProductCode: { notIn: seen }, isActive: true },
      data: { isActive: false },
    });
    await db.country.update({ where: { id: country.id }, data: { hasRentals: seen.length > 0 } });
    return { upserted: seen.length, deactivated: off.count };
  });
}

// ───────────── eSIM ─────────────

function destinationKind(kind: string): DestinationKind {
  return kind === "COUNTRY" || kind === "GLOBAL" ? kind : "REGION";
}

export async function syncEsimDestinations(adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);
  return withSyncLog(supplierId, "ESIM_DESTINATIONS", null, async () => {
    const list = await a.esim.listDestinations();
    const codes: string[] = [];
    const now = new Date();
    for (const d of list) {
      codes.push(d.locationCode);
      const kind = destinationKind(d.kind);
      const country = kind === "COUNTRY" && /^[A-Z]{2}$/i.test(d.locationCode) ? await upsertCountry(d.locationCode, d.name) : null;
      const existing = await db.esimDestination.findUnique({
        where: { supplierId_locationCode: { supplierId, locationCode: d.locationCode } },
      });
      let slug = existing?.slug ?? slugify(d.name);
      if (!existing && (await db.esimDestination.findUnique({ where: { slug } }))) slug = `${slug}-${slugify(d.locationCode)}`;
      const data = {
        name: d.name,
        kind,
        countryId: country?.id ?? null,
        packageCount: d.packageCount,
        fromCost: d.fromCost ? toDbAmount(d.fromCost) : null,
        topSpeed: d.topSpeed,
        isActive: d.packageCount > 0,
        lastSyncedAt: now,
      };
      if (existing) await db.esimDestination.update({ where: { id: existing.id }, data });
      else await db.esimDestination.create({ data: { ...data, supplierId, locationCode: d.locationCode, slug } });
    }
    const off = await db.esimDestination.updateMany({
      where: { supplierId, locationCode: { notIn: codes }, isActive: true },
      data: { isActive: false },
    });
    return { upserted: codes.length, deactivated: off.count };
  });
}

function packageData(p: EsimPackageInfo, destination: { id: string; countryId: string | null }, currency: string, now: Date) {
  return {
    name: p.name,
    slug: slugify(p.packageCode),
    destinationId: destination.id,
    countryId: destination.countryId,
    dataVolumeBytes: p.volumeBytes,
    dataLabel: p.dataLabel,
    validityDays: p.durationDays,
    unlimited: p.unlimited,
    pricingUnit: p.pricingUnit,
    speed: p.speed,
    fupPolicy: p.fupPolicy,
    ipExport: p.ipExport,
    includesPhoneNumber: p.includesPhoneNumber,
    includesSms: p.includesSms,
    includesVoice: p.includesVoice,
    wholesaleCost: toDbAmount(p.cost),
    wholesaleCurrency: currency,
    isActive: true,
    lastSyncedAt: now,
  };
}

export async function syncEsimPackages(destinationId: string, adapter?: SupplierAdapter): Promise<SyncResult> {
  const { adapter: a, supplierId } = await context(adapter);
  const destination = await db.esimDestination.findUniqueOrThrow({ where: { id: destinationId } });
  return withSyncLog(supplierId, "ESIM_PACKAGES", destination.locationCode, async () => {
    const packages = await a.esim.listPackages(destination.locationCode);
    const now = new Date();
    const codes: string[] = [];
    const type: ProductType = "ESIM";
    for (const p of packages) {
      codes.push(p.packageCode);
      const data = packageData(p, destination, a.priceCurrency, now);
      await db.product.upsert({
        where: { supplierId_type_supplierProductCode: { supplierId, type, supplierProductCode: p.packageCode } },
        update: data,
        create: { ...data, type, supplierId, supplierProductCode: p.packageCode },
      });
    }
    const off = await db.product.updateMany({
      where: { supplierId, type, destinationId: destination.id, supplierProductCode: { notIn: codes }, isActive: true },
      data: { isActive: false },
    });
    await db.esimDestination.update({
      where: { id: destination.id },
      data: { packagesSyncedAt: now, packageCount: packages.length, isActive: packages.length > 0 },
    });
    return { upserted: codes.length, deactivated: off.count };
  });
}

/** Full sync used by cron and the admin "sync now" action (bounded for rate limits). */
export async function syncAll(opts: { maxDestinations?: number } = {}): Promise<Record<string, SyncResult | string>> {
  const results: Record<string, SyncResult | string> = {};
  const run = async (name: string, fn: () => Promise<SyncResult>) => {
    try {
      results[name] = await fn();
    } catch (err) {
      results[name] = err instanceof Error ? `failed: ${err.message}` : "failed";
    }
  };
  await run("verification", () => syncVerificationCatalog());
  await run("rentals", () => syncRentalCountries());
  await run("esimDestinations", () => syncEsimDestinations());

  // Refresh the stalest destinations first.
  const stale = await db.esimDestination.findMany({
    where: { isActive: true },
    orderBy: [{ packagesSyncedAt: { sort: "asc", nulls: "first" } }],
    take: opts.maxDestinations ?? 20,
    select: { id: true, locationCode: true },
  });
  for (const d of stale) await run(`esimPackages:${d.locationCode}`, () => syncEsimPackages(d.id));
  return results;
}
