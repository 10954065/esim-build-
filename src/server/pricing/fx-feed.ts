import { z } from "zod";
import { dec } from "./money";

/**
 * Daily exchange rate feed from ExchangeRate-API's open access endpoint: no key, one update
 * a day, attribution required (the storefront footer links to it). Pure parsing and checks
 * only; fx-refresh.ts does the fetching and storage.
 */

export const FX_FEED_SOURCE = "exchangerate-api.com";
export const fxFeedUrl = (base: string) => `https://open.er-api.com/v6/latest/${base}`;

/** Largest relative move accepted between consecutive automatic rates (20%). */
export const MAX_RATE_CHANGE = "0.2";

const feedSchema = z.object({
  result: z.string(),
  "error-type": z.string().optional(),
  base_code: z.string().optional(),
  time_last_update_unix: z.number().int().positive().optional(),
  rates: z.record(z.string(), z.number()).optional(),
});

export interface FeedRate {
  rate: string;
  publishedAt: Date;
}

export function parseFeed(body: unknown, base: string, quote: string): FeedRate {
  const parsed = feedSchema.safeParse(body);
  if (!parsed.success) throw new Error("Exchange rate feed returned an unexpected body");
  const feed = parsed.data;
  if (feed.result !== "success") throw new Error(`Exchange rate feed failed: ${feed["error-type"] ?? feed.result}`);
  if (feed.base_code !== base) throw new Error(`Exchange rate feed returned base ${feed.base_code}, expected ${base}`);
  const value = feed.rates?.[quote];
  if (value === undefined) throw new Error(`Exchange rate feed has no ${quote} rate`);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Exchange rate feed returned an invalid ${quote} rate: ${value}`);
  if (!feed.time_last_update_unix) throw new Error("Exchange rate feed has no publish time");
  return { rate: String(value), publishedAt: new Date(feed.time_last_update_unix * 1000) };
}

/** A bad feed value must never reprice the whole catalogue: large jumps need a human. */
export function isPlausibleChange(next: string, previous: string | null): boolean {
  if (previous === null) return true;
  return dec(next).div(dec(previous)).minus(1).abs().lte(MAX_RATE_CHANGE);
}
