import "server-only";
import type { Job, Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";

/**
 * Durable Postgres job queue.
 * - enqueue(): idempotent via a unique dedupeKey (duplicates are silently skipped).
 * - claimJobs(): `FOR UPDATE SKIP LOCKED` so concurrent workers never take the same job;
 *   jobs stuck RUNNING for 10 minutes (crashed worker) are reclaimed.
 * - failJob(): exponential backoff with jitter; DEAD after maxAttempts.
 */

export type JobType =
  | "fulfil-order-item"
  | "reconcile-fulfilment"
  | "refund.submit"
  | "refund.reconcile"
  | "sandbox.refund.process"
  | "orders.expire-unpaid"
  | "verification.sweep"
  | "esim.sweep"
  | "refund.sweep"
  | "rental.sweep"
  | "catalog.sync"
  | "supplier.balance"
  | "maintenance.retention";

export interface EnqueueInput {
  type: JobType;
  payload?: Record<string, unknown>;
  runAt?: Date;
  dedupeKey?: string;
  maxAttempts?: number;
}

export async function enqueue(client: Tx | typeof db, input: EnqueueInput | EnqueueInput[]): Promise<number> {
  const list = Array.isArray(input) ? input : [input];
  const res = await client.job.createMany({
    data: list.map((j) => ({
      type: j.type,
      payload: (j.payload ?? {}) as Prisma.InputJsonValue,
      runAt: j.runAt ?? new Date(),
      dedupeKey: j.dedupeKey ?? null,
      maxAttempts: j.maxAttempts ?? 8,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function claimJobs(limit: number, workerId: string): Promise<Job[]> {
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "lockedBy" = ${workerId},
      "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'PENDING' AND "runAt" <= now())
         OR ("status" = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes')
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

export async function completeJob(id: string): Promise<void> {
  await db.job.update({ where: { id }, data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null } });
}

export function backoffSeconds(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(3600, 15 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base + base * 0.3 * random());
}

export async function failJob(job: Pick<Job, "id" | "attempts" | "maxAttempts">, error: string, retryable: boolean): Promise<"RETRY" | "DEAD"> {
  const dead = !retryable || job.attempts >= job.maxAttempts;
  await db.job.update({
    where: { id: job.id },
    data: dead
      ? { status: "DEAD", lastError: error.slice(0, 1000), lockedAt: null, lockedBy: null, completedAt: new Date() }
      : {
          status: "PENDING",
          lastError: error.slice(0, 1000),
          lockedAt: null,
          lockedBy: null,
          runAt: new Date(Date.now() + backoffSeconds(job.attempts) * 1000),
        },
  });
  return dead ? "DEAD" : "RETRY";
}

/** Throw from a handler to stop retrying (the job becomes DEAD immediately). */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
