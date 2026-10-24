/**
 * Development seed. Safe to run repeatedly.
 *
 * - Refuses to run when APP_ENV=production.
 * - Creates default (editable) pricing rules in the checkout currency.
 * - When SUPPLIER_MODE=sandbox, syncs the clearly-labelled DEMO catalogue from the
 *   sandbox supplier. Demo data is never mixed with a live supplier: every demo product
 *   belongs to the supplier row with code "sandbox" and mode SANDBOX.
 *
 * Run with: pnpm db:seed
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { getEnv } from "../src/server/env";

async function seedPricingRules(currency: string) {
  const defaults = [
    { name: "Default margin — all products (seed)", productType: null, markupPercent: "25", markupFixed: "0", minProfit: "0.30" },
    { name: "Default margin — verification numbers (seed)", productType: "VERIFICATION" as const, markupPercent: "45", markupFixed: "0.10", minProfit: "0.20" },
    { name: "Default margin — number rentals (seed)", productType: "RENTAL" as const, markupPercent: "35", markupFixed: "0", minProfit: "0.50" },
  ];
  for (const rule of defaults) {
    const existing = await db.pricingRule.findFirst({ where: { name: rule.name } });
    if (existing) continue;
    await db.pricingRule.create({ data: { ...rule, currency, priority: 0 } });
    console.info(`  + pricing rule: ${rule.name}`);
  }
}

async function main() {
  const env = getEnv();
  if (env.APP_ENV === "production") {
    throw new Error("Refusing to seed: APP_ENV=production");
  }
  console.info(`Seeding (APP_ENV=${env.APP_ENV}, SUPPLIER_MODE=${env.SUPPLIER_MODE}, currency=${env.PAYMENT_CURRENCY})`);

  await seedPricingRules(env.PAYMENT_CURRENCY);

  if (env.SUPPLIER_MODE === "sandbox") {
    const { syncAll, refreshVerificationOffers, refreshRentalOffers } = await import("../src/server/catalog/sync");
    const results = await syncAll({ maxDestinations: 50 });
    for (const [k, v] of Object.entries(results)) console.info(`  sync ${k}:`, v);
    for (const code of ["US", "GB", "GH"]) {
      await refreshVerificationOffers(code).catch((e: unknown) => console.warn(`  offers ${code} failed`, e));
    }
    for (const code of ["US", "GB"]) {
      await refreshRentalOffers(code).catch((e: unknown) => console.warn(`  rentals ${code} failed`, e));
    }
    console.info("  DEMO catalogue synced from the sandbox supplier (not real inventory).");
  } else {
    console.info("  Supplier is not in sandbox mode — no catalogue seeded. Use the admin 'Sync catalogue' action.");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
