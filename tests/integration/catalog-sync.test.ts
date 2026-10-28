import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { refreshRentalOffers, refreshVerificationOffers, syncRentalCountries, syncVerificationCatalog } from "@/server/catalog/sync";
import { getSupplierAdapter, type SupplierAdapter } from "@/server/providers/supplier";
import type { RentalPricing, VerificationOffer } from "@/server/providers/supplier/types";
import { resetDatabase } from "./helpers";

function offer(serviceSlug: string, operator: string, stock: number, cost: string): VerificationOffer {
  return { countryCode: "US", serviceSlug, serviceName: serviceSlug.toUpperCase(), providerTier: "STANDARD", operator, cost, stock, deliverability: 90 };
}

function withOffers(offers: VerificationOffer[]): SupplierAdapter {
  const base = getSupplierAdapter();
  return { ...base, verification: { ...base.verification, getOffers: async () => offers } };
}

function withRentals(pricing: RentalPricing): SupplierAdapter {
  const base = getSupplierAdapter();
  return { ...base, rentals: { ...base.rentals, getRentalPricing: async () => pricing } };
}

describe("catalogue offer sync", () => {
  beforeAll(async () => {
    await resetDatabase();
    await syncVerificationCatalog();
    await syncRentalCountries();
  });

  it("creates new verification offers and the services they reference", async () => {
    const result = await refreshVerificationOffers("US", withOffers([
      offer("brand-new-app", "any", 120, "0.40"),
      offer("brand-new-app", "tmobile", 0, "0.55"),
    ]));

    expect(result).toEqual({ upserted: 2, deactivated: 0 });
    const service = await db.service.findFirstOrThrow({ where: { slug: "brand-new-app" } });
    expect(service.name).toBe("BRAND-NEW-APP");
    const products = await db.product.findMany({ where: { serviceId: service.id }, orderBy: { operator: "asc" } });
    expect(products.map((p) => [p.operator, p.stockCount, p.wholesaleCost.toString(), p.isActive])).toEqual([
      ["any", 120, "0.4", true],
      ["tmobile", 0, "0.55", false],
    ]);
  });

  it("updates offers in place, keeps staff visibility and deactivates offers that disappear", async () => {
    const before = await db.product.findFirstOrThrow({ where: { type: "VERIFICATION", operator: "any", service: { slug: "brand-new-app" } } });
    await db.product.update({ where: { id: before.id }, data: { isVisible: false } });

    const result = await refreshVerificationOffers("US", withOffers([offer("brand-new-app", "any", 75, "0.45")]));

    expect(result).toEqual({ upserted: 1, deactivated: 0 });
    const after = await db.product.findUniqueOrThrow({ where: { id: before.id } });
    expect([after.stockCount, after.wholesaleCost.toString(), after.isActive, after.isVisible]).toEqual([75, "0.45", true, false]);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.lastSyncedAt.getTime()).toBeGreaterThan(before.lastSyncedAt.getTime());
    const gone = await db.product.findFirstOrThrow({ where: { type: "VERIFICATION", operator: "tmobile", service: { slug: "brand-new-app" } } });
    expect(gone.isActive).toBe(false);
  });

  it("deactivates offers that are still listed elsewhere but dropped by the supplier", async () => {
    const result = await refreshVerificationOffers("US", withOffers([offer("other-app", "any", 5, "1.00")]));

    expect(result.deactivated).toBe(1);
    const stale = await db.product.findFirstOrThrow({ where: { type: "VERIFICATION", operator: "any", service: { slug: "brand-new-app" } } });
    expect(stale.isActive).toBe(false);
  });

  it("keeps the last entry when the supplier lists the same offer twice", async () => {
    await refreshVerificationOffers("US", withOffers([offer("twice-app", "any", 10, "0.30"), offer("twice-app", "any", 20, "0.35")]));

    const product = await db.product.findFirstOrThrow({ where: { type: "VERIFICATION", service: { slug: "twice-app" } } });
    expect([product.stockCount, product.wholesaleCost.toString()]).toEqual([20, "0.35"]);
  });

  it("writes rental terms for all-services and per-service numbers", async () => {
    const result = await refreshRentalOffers("GB", withRentals({
      countryCode: "GB",
      unlimited: [{ term: "7d", days: 7, hours: 168, cost: "3.00" }],
      services: [{ serviceSlug: "rental-only-app", serviceName: "Rental Only", terms: [{ term: "30d", days: 30, hours: null, cost: "9.50" }] }],
    }));

    expect(result).toEqual(expect.objectContaining({ upserted: 2 }));
    const rentals = await db.product.findMany({ where: { type: "RENTAL", country: { code: "GB" }, isActive: true }, orderBy: { rentalTerm: "asc" } });
    expect(rentals.map((r) => [r.rentalType, r.rentalTerm, r.durationHours, r.wholesaleCost.toString()])).toEqual([
      ["service", "30d", 720, "9.5"],
      ["unlimited", "7d", 168, "3"],
    ]);
    expect(rentals[0]?.name).toMatch(/^Rental Only number · .+ · 30d$/);
  });
});
