import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * Set-based writes for catalogue sync. A country can carry several hundred offers; writing them
 * one upsert at a time costs a database round trip each, which on a remote pooler adds up to
 * minutes. These helpers write a whole country in a handful of statements.
 */

/** Rows per INSERT; 20 columns each keeps every statement far below Postgres's 65,535 parameter cap. */
const CHUNK_SIZE = 500;

export interface CatalogProductRow {
  supplierProductCode: string;
  name: string;
  slug: string;
  countryId: string | null;
  serviceId: string | null;
  providerTier?: string | null;
  operator?: string | null;
  stockCount?: number | null;
  deliverability?: number | null;
  rentalTerm?: string | null;
  rentalType?: string | null;
  durationHours?: number | null;
  wholesaleCost: string;
  wholesaleCurrency: string;
  isActive: boolean;
}

/**
 * Insert or update products keyed by (supplier, type, supplier product code). Existing rows keep
 * their id, createdAt and staff controlled isVisible, so orders and pricing rules stay attached.
 */
export async function bulkUpsertProducts(
  supplierId: string,
  type: "VERIFICATION" | "RENTAL",
  rows: readonly CatalogProductRow[],
  now: Date,
): Promise<void> {
  // One INSERT cannot touch the same row twice, so a code the supplier lists twice keeps its last entry.
  const unique = [...new Map(rows.map((r) => [r.supplierProductCode, r])).values()];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const values = unique.slice(i, i + CHUNK_SIZE).map(
      (r) => Prisma.sql`(
        ${randomUUID()}::uuid, ${type}::"ProductType", ${supplierId}::uuid, ${r.supplierProductCode}, ${r.name}, ${r.slug},
        ${r.countryId}::uuid, ${r.serviceId}::uuid, ${r.providerTier ?? null}, ${r.operator ?? null},
        ${r.stockCount ?? null}::integer, ${r.deliverability ?? null}::integer,
        ${r.rentalTerm ?? null}, ${r.rentalType ?? null}, ${r.durationHours ?? null}::integer,
        ${r.wholesaleCost}::decimal, ${r.wholesaleCurrency}, ${r.isActive}, ${now}, ${now}
      )`,
    );
    await db.$executeRaw`
      INSERT INTO "Product" (
        "id", "type", "supplierId", "supplierProductCode", "name", "slug",
        "countryId", "serviceId", "providerTier", "operator",
        "stockCount", "deliverability",
        "rentalTerm", "rentalType", "durationHours",
        "wholesaleCost", "wholesaleCurrency", "isActive", "lastSyncedAt", "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("supplierId", "type", "supplierProductCode") DO UPDATE SET
        "name" = EXCLUDED."name",
        "slug" = EXCLUDED."slug",
        "countryId" = EXCLUDED."countryId",
        "serviceId" = EXCLUDED."serviceId",
        "providerTier" = EXCLUDED."providerTier",
        "operator" = EXCLUDED."operator",
        "stockCount" = EXCLUDED."stockCount",
        "deliverability" = EXCLUDED."deliverability",
        "rentalTerm" = EXCLUDED."rentalTerm",
        "rentalType" = EXCLUDED."rentalType",
        "durationHours" = EXCLUDED."durationHours",
        "wholesaleCost" = EXCLUDED."wholesaleCost",
        "wholesaleCurrency" = EXCLUDED."wholesaleCurrency",
        "isActive" = EXCLUDED."isActive",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

/**
 * Make sure every referenced service exists (new ones are created with the supplier's name;
 * existing ones are left untouched) and return them by slug.
 */
export async function ensureServices(
  supplierId: string,
  services: ReadonlyArray<{ slug: string; name: string }>,
): Promise<Map<string, { id: string; slug: string; name: string }>> {
  const unique = [...new Map(services.map((s) => [s.slug, s])).values()];
  if (unique.length === 0) return new Map();
  await db.service.createMany({
    data: unique.map((s) => ({ supplierId, slug: s.slug, name: s.name })),
    skipDuplicates: true,
  });
  const rows = await db.service.findMany({
    where: { supplierId, slug: { in: unique.map((s) => s.slug) } },
    select: { id: true, slug: true, name: true },
  });
  return new Map(rows.map((r) => [r.slug, r]));
}
