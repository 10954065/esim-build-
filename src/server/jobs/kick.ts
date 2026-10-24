import "server-only";
import { after } from "next/server";
import { logger } from "@/server/logger";

/**
 * Process a few queued jobs right after the current response is sent, so customers do not
 * wait for the next cron tick. The cron route remains the guaranteed processor.
 */
export function kickJobs(maxJobs = 10): void {
  const run = async () => {
    try {
      const { runJobs } = await import("./runner");
      await runJobs({ maxJobs, timeBudgetMs: 25000, workerId: `kick-${process.pid}` });
    } catch (err) {
      logger.warn("background job kick failed", { err });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (tests, scripts): the cron/runner will pick the jobs up.
  }
}
