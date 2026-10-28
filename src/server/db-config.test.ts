import { describe, expect, it } from "vitest";
import { poolConfig } from "./db-config";

const CA = "-----BEGIN CERTIFICATE-----\nMIIDxTCCAq2gAwIBAgIBADANBgkqhkiG9w0BAQsFADB\n-----END CERTIFICATE-----";
const POOLED = "postgresql://postgres.abc:p%40ss@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

describe("poolConfig", () => {
  it("passes the URL through untouched when no CA is configured", () => {
    const config = poolConfig({ DATABASE_URL: `${POOLED}?sslmode=require` });
    expect(config).toEqual({ connectionString: `${POOLED}?sslmode=require`, max: 10 });
  });

  it("verifies the server against the configured CA", () => {
    const config = poolConfig({ DATABASE_URL: POOLED, DATABASE_SSL_CA: CA });
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it("drops TLS query parameters so they cannot override the CA check", () => {
    const config = poolConfig({
      DATABASE_URL: `${POOLED}?sslmode=no-verify&uselibpqcompat=true&schema=public`,
      DATABASE_SSL_CA: CA,
    });
    expect(config.connectionString).toBe(`${POOLED}?schema=public`);
  });

  it("keeps an encoded password intact", () => {
    const config = poolConfig({ DATABASE_URL: `${POOLED}?sslmode=require`, DATABASE_SSL_CA: CA });
    expect(config.connectionString).toContain("postgres.abc:p%40ss@");
  });

  it("accepts a CA pasted with escaped newlines", () => {
    const config = poolConfig({ DATABASE_URL: POOLED, DATABASE_SSL_CA: CA.replace(/\n/g, "\\n") });
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it("reads the pool size from DATABASE_POOL_MAX", () => {
    expect(poolConfig({ DATABASE_URL: POOLED, DATABASE_POOL_MAX: "3" }).max).toBe(3);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => poolConfig({})).toThrow("DATABASE_URL is not configured");
  });
});
