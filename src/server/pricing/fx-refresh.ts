import "server-only";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { getSetting } from "@/server/settings";
import { FX_FEED_SOURCE, fxFeedUrl, isPlausibleChange, parseFeed } from "./fx-feed";

/**
 * Keeps the supplier→checkout exchange rate current from the daily feed. A rate entered by
 * staff (createdById set) wins until it ages out. When the feed fails or jumps implausibly,
 * the previous rate stays in force; once it passes pricing.fxMaxAgeHours, prices hide rather
 * than show a wrong amount.
 */

const FEED_TIMEOUT_MS = 10_000;
/** Only a recent rate is a fair yardstick for the plausibility check. */
const PLAUSIBILITY_WINDOW_MS = 7 * 24 * 3600 * 1000;

const log = logger.child({ component: "fx-refresh" });

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type FxRefreshResult =
  | { status: "updated"; rate: string; publishedAt: Date }
  | { status: "skipped"; reason: "same-currency" | "manual-override" };

export async function refreshExchangeRate(opts: {
  base: string;
  quote: string;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<FxRefreshResult> {
  const { base, quote, fetchImpl = fetch, now = new Date() } = opts;
  if (base === quote) return { status: "skipped", reason: "same-currency" };

  const latest = await db.exchangeRate.findFirst({
    where: { baseCurrency: base, quoteCurrency: quote, effectiveAt: { lte: now } },
    orderBy: { effectiveAt: "desc" },
  });
  const maxAgeMs = (await getSetting("pricing.fxMaxAgeHours")) * 3600 * 1000;
  const ageMs = latest ? now.getTime() - latest.effectiveAt.getTime() : Infinity;
  if (latest?.createdById && ageMs <= maxAgeMs) return { status: "skipped", reason: "manual-override" };

  const res = await fetchImpl(fxFeedUrl(base), { signal: AbortSignal.timeout(FEED_TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Exchange rate feed responded ${res.status}`);
  const { rate, publishedAt } = parseFeed(await res.json(), base, quote);

  const previous = latest && ageMs <= PLAUSIBILITY_WINDOW_MS ? latest.rate.toString() : null;
  if (!isPlausibleChange(rate, previous)) {
    throw new Error(`Implausible ${base}/${quote} rate ${rate} (previous ${previous}); keeping the previous rate`);
  }

  await db.exchangeRate.create({
    data: { baseCurrency: base, quoteCurrency: quote, rate, source: `${FX_FEED_SOURCE} (published ${publishedAt.toISOString()})`, effectiveAt: now },
  });
  log.info("exchange rate refreshed", { base, quote, rate, publishedAt: publishedAt.toISOString() });
  return { status: "updated", rate, publishedAt };
}
