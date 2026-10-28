import type { PoolConfig } from "pg";

/** pg builds its own TLS settings from these URL parameters, overriding the `ssl` option. */
const TLS_URL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];
const DEFAULT_POOL_MAX = 10;

/** Reads DATABASE_URL, DATABASE_POOL_MAX and DATABASE_SSL_CA. */
type DbEnv = Record<string, string | undefined>;

/**
 * Settings for the pg connection pool.
 *
 * With DATABASE_SSL_CA (a PEM certificate, such as Supabase's root CA) the server
 * certificate is verified against that CA. Hosts whose certificate chains to a
 * public CA need no CA here: `?sslmode=verify-full` on the URL is enough.
 */
export function poolConfig(env: DbEnv): PoolConfig {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const max = Number(env.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX);

  const ca = env.DATABASE_SSL_CA?.trim().replace(/\\n/g, "\n");
  if (!ca) return { connectionString: url, max };

  const parsed = new URL(url);
  for (const param of TLS_URL_PARAMS) parsed.searchParams.delete(param);
  return { connectionString: parsed.toString(), max, ssl: { ca, rejectUnauthorized: true } };
}
