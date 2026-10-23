import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single PrismaClient per process (connection pool). In development the instance is
 * cached on globalThis so hot reloads do not exhaust connections.
 */

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;

export type Db = PrismaClient;
/** Interactive transaction client type. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
