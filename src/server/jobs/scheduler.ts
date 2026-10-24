import "server-only";
import { db } from "@/server/db";
import { enqueue, type JobType } from "./queue";

/**
 * Recurring work, enqueued idempotently on every cron tick. The dedupe key includes the
 * time bucket, so each task runs at most once per interval no matter how often cron fires.
 */
const RECURRING: Array<{ type: JobType; everyMinutes: number }> = [
  { type: "verification.sweep", everyMinutes: 1 },
  { type: "esim.sweep", everyMinutes: 2 },
  { type: "orders.expire-unpaid", everyMinutes: 5 },
  { type: "refund.sweep", everyMinutes: 5 },
  { type: "rental.sweep", everyMinutes: 15 },
  { type: "supplier.balance", everyMinutes: 30 },
  { type: "catalog.sync", everyMinutes: 60 },
  { type: "maintenance.retention", everyMinutes: 24 * 60 },
];

export async function scheduleRecurring(now = new Date()): Promise<number> {
  const minute = Math.floor(now.getTime() / 60000);
  return enqueue(
    db,
    RECURRING.map((r) => ({
      type: r.type,
      dedupeKey: `${r.type}:${Math.floor(minute / r.everyMinutes)}`,
      maxAttempts: 2,
    })),
  );
}
