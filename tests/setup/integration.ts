import { randomBytes } from "node:crypto";
import "dotenv/config";

/**
 * Integration tests run against a real PostgreSQL database (esim_test), never the
 * development database, and always with sandbox providers.
 */
const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://esim:esim_dev_password@localhost:55433/esim_test?schema=public";
if (!/esim_test/.test(testUrl)) {
  throw new Error("Integration tests must target a database whose name contains 'esim_test'");
}
process.env.DATABASE_URL = testUrl;
process.env.APP_ENV = "test";
process.env.LOG_SILENT = "1";
process.env.SUPPLIER_MODE = "sandbox";
process.env.PAYMENT_PROVIDER = "sandbox";
process.env.EMAIL_PROVIDER = "log";
process.env.PAYMENT_CURRENCY = "USD";
process.env.SUPPLIER_PRICE_CURRENCY = "USD";
process.env.SANDBOX_SIGNING_SECRET = "integration-sandbox-secret";
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.BETTER_AUTH_SECRET = "integration-auth-secret-integration-auth-secret";
process.env.APP_URL = "http://localhost:3000";
