import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const base = {
  DATABASE_URL: "postgresql://x",
  BETTER_AUTH_SECRET: "x".repeat(40),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};

function issues(input: Record<string, string>) {
  const r = envSchema.safeParse({ ...base, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

describe("environment guards", () => {
  it("accepts a sandbox development configuration", () => {
    expect(issues({ SUPPLIER_MODE: "sandbox", PAYMENT_PROVIDER: "sandbox", SANDBOX_SIGNING_SECRET: "s" })).toEqual([]);
  });

  it("forbids sandbox providers and the log mailer in production", () => {
    const found = issues({
      APP_ENV: "production",
      APP_URL: "https://shop.example",
      CRON_SECRET: "c",
      SUPPLIER_MODE: "sandbox",
      PAYMENT_PROVIDER: "sandbox",
      SANDBOX_SIGNING_SECRET: "s",
      EMAIL_PROVIDER: "log",
    });
    expect(found).toEqual(expect.arrayContaining(["SUPPLIER_MODE", "PAYMENT_PROVIDER", "EMAIL_PROVIDER"]));
  });

  it("never allows demo payments to buy live supplier products (or vice versa)", () => {
    expect(
      issues({ SUPPLIER_MODE: "live", SMS1001_API_KEY: "k", SMS1001_WEBHOOK_SECRET: "w", PAYMENT_PROVIDER: "sandbox", SANDBOX_SIGNING_SECRET: "s" }),
    ).toContain("PAYMENT_PROVIDER");
    expect(issues({ SUPPLIER_MODE: "sandbox", SANDBOX_SIGNING_SECRET: "s", PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk" })).toContain(
      "PAYMENT_PROVIDER",
    );
  });

  it("requires credentials for live integrations", () => {
    expect(issues({ SUPPLIER_MODE: "live" })).toEqual(expect.arrayContaining(["SMS1001_API_KEY", "SMS1001_WEBHOOK_SECRET"]));
    expect(issues({ PAYMENT_PROVIDER: "paystack" })).toContain("PAYSTACK_SECRET_KEY");
    expect(issues({ EMAIL_PROVIDER: "resend" })).toContain("RESEND_API_KEY");
  });

  it("rejects weak secrets and malformed encryption keys", () => {
    expect(issues({ BETTER_AUTH_SECRET: "short" })).toContain("BETTER_AUTH_SECRET");
    expect(issues({ DATA_ENCRYPTION_KEY: "abc" })).toContain("DATA_ENCRYPTION_KEY");
  });
});
