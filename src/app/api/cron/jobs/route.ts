import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { runJobs } from "@/server/jobs/runner";
import { scheduleRecurring } from "@/server/jobs/scheduler";

// Long-running: drains the job queue within the function's time budget.
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return getEnv().APP_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel Cron entry point: schedule recurring work, then process due jobs. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scheduled = await scheduleRecurring();
  const summary = await runJobs({ maxJobs: 100, timeBudgetMs: 50000, workerId: "cron" });
  return NextResponse.json({ scheduled, ...summary });
}
