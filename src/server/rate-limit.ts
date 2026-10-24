import "server-only";
import { db } from "@/server/db";

/**
 * Database-backed fixed-window rate limiting for application endpoints (purchases,
 * polling, support, sign-up). Atomic single-statement upsert; no Redis required.
 * Better Auth endpoints use Better Auth's own limiter (database storage).
 */

export interface RateLimitResult {
  ok: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, now(), now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN now() ELSE "RateLimitBucket"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= now()
        THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count", "expiresAt"
  `;
  const row = rows[0]!;
  const count = Number(row.count);
  return {
    ok: count <= limit,
    count,
    limit,
    retryAfterSeconds: Math.max(0, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds} seconds.`);
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const r = await consumeRateLimit(key, limit, windowSeconds);
  if (!r.ok) throw new RateLimitError(r.retryAfterSeconds);
}

/** Housekeeping: drop expired buckets (called from the maintenance cron). */
export async function purgeExpiredRateLimits(): Promise<number> {
  const res = await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}
