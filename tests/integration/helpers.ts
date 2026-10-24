import { randomUUID } from "node:crypto";
import { db } from "@/server/db";

/** Reset every application table (TRUNCATE bypasses the ledger's row-level DELETE trigger). */
export async function resetDatabase(): Promise<void> {
  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  if (list) await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function createUser(overrides: { email?: string; role?: "user" | "support" | "finance" | "admin" } = {}) {
  const id = randomUUID().replace(/-/g, "");
  return db.user.create({
    data: {
      id,
      name: "Test Customer",
      email: overrides.email ?? `user-${id.slice(0, 8)}@example.test`,
      emailVerified: true,
      role: overrides.role ?? "user",
      profile: { create: {} },
    },
  });
}

export async function seedPricingAndCatalog(): Promise<void> {
  await db.pricingRule.create({ data: { name: "Test global margin", markupPercent: "25", markupFixed: "0", minProfit: "0.30", currency: "USD" } });
  const { syncVerificationCatalog, syncEsimDestinations, syncEsimPackages, refreshVerificationOffers, syncRentalCountries, refreshRentalOffers } = await import("@/server/catalog/sync");
  await syncVerificationCatalog();
  await syncRentalCountries();
  await syncEsimDestinations();
  const spain = await db.esimDestination.findFirstOrThrow({ where: { locationCode: "ES" } });
  await syncEsimPackages(spain.id);
  await refreshVerificationOffers("US");
  await refreshRentalOffers("GB");
}

export async function drainJobs(rounds = 6): Promise<void> {
  const { runJobs } = await import("@/server/jobs/runner");
  for (let i = 0; i < rounds; i++) {
    // Make delayed jobs due immediately so tests do not wait for backoff timers.
    await db.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date(Date.now() - 1000) } });
    const r = await runJobs({ maxJobs: 50, timeBudgetMs: 20000, workerId: "test" });
    if (r.processed === 0) break;
  }
}

export async function ledgerIsBalanced(): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ currency: string; balance: string }>>`
    SELECT currency, SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END)::text AS balance
    FROM "LedgerEntry" GROUP BY currency
  `;
  return rows.every((r) => Number(r.balance) === 0);
}
