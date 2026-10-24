import "server-only";
import type { Job } from "@/generated/prisma/client";
import { logger } from "@/server/logger";
import { HANDLERS } from "./handlers";
import { claimJobs, completeJob, failJob, PermanentJobError, type JobType } from "./queue";

const log = logger.child({ component: "job-runner" });

export interface RunSummary {
  processed: number;
  succeeded: number;
  retried: number;
  dead: number;
}

async function execute(job: Job): Promise<"ok" | "RETRY" | "DEAD"> {
  const handler = HANDLERS[job.type as JobType];
  if (!handler) return failJob(job, `No handler for job type ${job.type}`, false);
  const started = Date.now();
  try {
    await handler((job.payload ?? {}) as Record<string, unknown>);
    await completeJob(job.id);
    log.debug("job succeeded", { jobId: job.id, type: job.type, durationMs: Date.now() - started });
    return "ok";
  } catch (err) {
    const permanent = err instanceof PermanentJobError;
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const result = await failJob(job, message, !permanent);
    (result === "DEAD" ? log.error : log.warn)("job failed", { jobId: job.id, type: job.type, attempts: job.attempts, result, err });
    return result;
  }
}

/** Drain due jobs within a time budget. Safe to run concurrently (SKIP LOCKED). */
export async function runJobs(opts: { maxJobs?: number; timeBudgetMs?: number; workerId?: string } = {}): Promise<RunSummary> {
  const maxJobs = opts.maxJobs ?? 25;
  const budget = opts.timeBudgetMs ?? 25000;
  const workerId = opts.workerId ?? `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const started = Date.now();
  const summary: RunSummary = { processed: 0, succeeded: 0, retried: 0, dead: 0 };
  while (summary.processed < maxJobs && Date.now() - started < budget) {
    const jobs = await claimJobs(Math.min(5, maxJobs - summary.processed), workerId);
    if (jobs.length === 0) break;
    for (const job of jobs) {
      const r = await execute(job);
      summary.processed++;
      if (r === "ok") summary.succeeded++;
      else if (r === "RETRY") summary.retried++;
      else summary.dead++;
    }
  }
  return summary;
}
