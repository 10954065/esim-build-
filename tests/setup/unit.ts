import { randomBytes } from "node:crypto";

// Unit tests never touch real services. Provide deterministic, throwaway configuration.
process.env.LOG_SILENT = "1";
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.DATABASE_URL ??= "postgresql://unit:unit@localhost:1/unit";
process.env.BETTER_AUTH_SECRET ??= "unit-test-secret-unit-test-secret-0123456789";
