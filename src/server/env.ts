import "server-only";
import { z } from "zod";

/**
 * Server environment validation.
 *
 * Rules enforced here (see docs/SECURITY.md):
 * - Secrets never use the NEXT_PUBLIC_ prefix and are only read on the server.
 * - Demo (sandbox) mode can never be enabled when APP_ENV=production.
 * - Sandbox payments and sandbox supplier fulfilment must be paired, so a fake
 *   payment can never buy a real supplier product and real money can never buy a
 *   simulated product.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    APP_NAME: z.string().default("Roamwell"),
    SUPPORT_EMAIL: z.email().default("support@example.com"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // PEM certificate the database server is verified against (Supabase's root CA).
    DATABASE_SSL_CA: optionalString.refine(
      (v) => !v || v.includes("-----BEGIN CERTIFICATE-----"),
      "DATABASE_SSL_CA must be the certificate's PEM contents, not a file name",
    ),

    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    DATA_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
    // Retired keys, comma-separated: still accepted for decryption during a key rotation.
    DATA_ENCRYPTION_KEYS_PREVIOUS: optionalString.refine(
      (v) => !v || v.split(",").every((k) => !k.trim() || Buffer.from(k.trim(), "base64").length === 32),
      "Each DATA_ENCRYPTION_KEYS_PREVIOUS entry must be 32 bytes, base64-encoded",
    ),

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    SUPPLIER_MODE: z.enum(["live", "sandbox", "disabled"]).default("disabled"),
    SMS1001_BASE_URL: z.url().default("https://www.1001sms.com/api/v1"),
    SMS1001_API_KEY: optionalString,
    SMS1001_WEBHOOK_SECRET: optionalString,
    /** 1001SMS does not document its price currency. Confirm with the supplier. */
    SUPPLIER_PRICE_CURRENCY: z.string().length(3).toUpperCase().default("USD"),
    SUPPLIER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),

    PAYMENT_PROVIDER: z.enum(["paystack", "sandbox", "disabled"]).default("disabled"),
    PAYMENT_CURRENCY: z.string().length(3).toUpperCase().default("USD"),
    PAYSTACK_SECRET_KEY: optionalString,
    PAYSTACK_BASE_URL: z.url().default("https://api.paystack.co"),
    SANDBOX_SIGNING_SECRET: optionalString,

    EMAIL_PROVIDER: z.enum(["resend", "log"]).default("log"),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default("Roamwell <no-reply@example.com>"),

    CRON_SECRET: optionalString,
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (env.APP_ENV === "production") {
      if (env.SUPPLIER_MODE === "sandbox") issue("SUPPLIER_MODE", "Sandbox supplier mode is forbidden in production");
      if (env.PAYMENT_PROVIDER === "sandbox") issue("PAYMENT_PROVIDER", "Sandbox payments are forbidden in production");
      if (env.EMAIL_PROVIDER === "log") issue("EMAIL_PROVIDER", "The log email provider is forbidden in production");
      if (!env.CRON_SECRET) issue("CRON_SECRET", "CRON_SECRET is required in production");
      if (!env.APP_URL.startsWith("https://")) issue("APP_URL", "APP_URL must use https in production");
    }

    const paySandbox = env.PAYMENT_PROVIDER === "sandbox";
    const supplierSandbox = env.SUPPLIER_MODE === "sandbox";
    const bothConfigured = env.PAYMENT_PROVIDER !== "disabled" && env.SUPPLIER_MODE !== "disabled";
    if (bothConfigured && paySandbox !== supplierSandbox) {
      issue(
        "PAYMENT_PROVIDER",
        "Sandbox payments and the sandbox supplier must be enabled together (never mix demo and live money or products)",
      );
    }

    if (env.SUPPLIER_MODE === "live") {
      if (!env.SMS1001_API_KEY) issue("SMS1001_API_KEY", "Required when SUPPLIER_MODE=live");
      if (!env.SMS1001_WEBHOOK_SECRET) issue("SMS1001_WEBHOOK_SECRET", "Required when SUPPLIER_MODE=live");
    }
    if (env.PAYMENT_PROVIDER === "paystack" && !env.PAYSTACK_SECRET_KEY) {
      issue("PAYSTACK_SECRET_KEY", "Required when PAYMENT_PROVIDER=paystack");
    }
    if ((paySandbox || supplierSandbox) && !env.SANDBOX_SIGNING_SECRET) {
      issue("SANDBOX_SIGNING_SECRET", "Required when the sandbox payment provider or sandbox supplier is enabled");
    }
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      issue("RESEND_API_KEY", "Required when EMAIL_PROVIDER=resend");
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

/** Parse and cache the environment. Throws a readable error listing every problem. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment configuration:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

/** True when the platform runs with simulated supplier and payment providers. */
export function isDemoMode(): boolean {
  const env = getEnv();
  return env.SUPPLIER_MODE === "sandbox" || env.PAYMENT_PROVIDER === "sandbox";
}
