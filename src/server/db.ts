import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { poolConfig } from "./db-config";

/**
 * Single PrismaClient per process (connection pool). In development the instance is
 * cached on globalThis so hot reloads do not exhaust connections.
 */

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(process.env)) });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;

export type Db = PrismaClient;
/** Interactive transaction client type. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
