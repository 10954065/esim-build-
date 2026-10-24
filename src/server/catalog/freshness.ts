import "server-only";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { isSupplierConfigured } from "@/server/providers/supplier";
import { getSetting } from "@/server/settings";
import {
  refreshRentalOffers,
  refreshVerificationOffers,
  syncEsimDestinations,
  syncEsimPackages,
  syncRentalCountries,
  syncVerificationCatalog,
} from "./sync";

/**
 * On-demand freshness. Public pages call these before reading the catalogue; a stale
 * section is refreshed from the supplier, bounded by TTL settings. Concurrent callers
 * share one in-flight refresh. Failures never break the page: stale data is served and
 * the error is logged (and visible in the admin sync log).
 */

const log = logger.child({ component: "catalog-freshness" });
const inflight = new Map<string, Promise<unknown>>();
const CATALOG_TTL_MS = 24 * 3600 * 1000;

async function once(key: string, fn: () => Promise<unknown>): Promise<void> {
  const existing = inflight.get(key);
  if (existing) {
    await existing.catch(() => undefined);
    return;
  }
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  try {
    await p;
  } catch (err) {
    log.warn("catalog refresh failed; serving stored data", { key, err });
  }
}

function isStale(at: Date | null | undefined, ttlMs: number, now = Date.now()): boolean {
  return !at || now - at.getTime() > ttlMs;
}

async function lastSuccess(kind: "VERIFICATION_COUNTRIES" | "RENTAL_COUNTRIES" | "ESIM_DESTINATIONS" | "RENTAL_PRICING", scope: string | null) {
  const row = await db.catalogSyncLog.findFirst({
    where: { kind, scope, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return row?.startedAt ?? null;
}

export async function ensureEsimDestinations(): Promise<void> {
  if (!isSupplierConfigured()) return;
  if (isStale(await lastSuccess("ESIM_DESTINATIONS", null), CATALOG_TTL_MS)) {
    await once("esim:destinations", () => syncEsimDestinations());
  }
}

export async function ensureEsimPackages(destination: { id: string; packagesSyncedAt: Date | null }): Promise<void> {
  if (!isSupplierConfigured()) return;
  const ttl = (await getSetting("catalog.esimPackagesTtlMinutes")) * 60 * 1000;
  if (isStale(destination.packagesSyncedAt, ttl)) {
    await once(`esim:packages:${destination.id}`, () => syncEsimPackages(destination.id));
  }
}

export async function ensureVerificationCatalog(): Promise<void> {
  if (!isSupplierConfigured()) return;
  if (isStale(await lastSuccess("VERIFICATION_COUNTRIES", null), CATALOG_TTL_MS)) {
    await once("verification:catalog", () => syncVerificationCatalog());
  }
}

export async function ensureVerificationOffers(country: { code: string; offersSyncedAt: Date | null }): Promise<void> {
  if (!isSupplierConfigured()) return;
  const ttl = (await getSetting("catalog.offersTtlMinutes")) * 60 * 1000;
  if (isStale(country.offersSyncedAt, ttl)) {
    await once(`verification:offers:${country.code}`, () => refreshVerificationOffers(country.code));
  }
}

export async function ensureRentalCountries(): Promise<void> {
  if (!isSupplierConfigured()) return;
  if (isStale(await lastSuccess("RENTAL_COUNTRIES", null), CATALOG_TTL_MS)) {
    await once("rentals:countries", () => syncRentalCountries());
  }
}

export async function ensureRentalOffers(countryCode: string): Promise<void> {
  if (!isSupplierConfigured()) return;
  const ttl = (await getSetting("catalog.offersTtlMinutes")) * 60 * 1000;
  if (isStale(await lastSuccess("RENTAL_PRICING", countryCode.toUpperCase()), ttl)) {
    await once(`rentals:offers:${countryCode}`, () => refreshRentalOffers(countryCode));
  }
}
