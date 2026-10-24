import "dotenv/config";
import { Client } from "pg";

/**
 * Every E2E run registers several accounts from 127.0.0.1, so repeated local runs trip the
 * (intentional) sign-up rate limits. Start each run with empty rate-limit windows.
 * Rate-limit rows are short-lived counters; nothing else is touched.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.APP_ENV === "production") throw new Error("E2E tests must never run against a production database");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimitBucket"`);
    await client.query(`DELETE FROM "rateLimit"`);
  } finally {
    await client.end();
  }
}
