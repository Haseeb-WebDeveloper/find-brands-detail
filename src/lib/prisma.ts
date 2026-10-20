import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * One Pool and one client per server instance, cached on globalThis so dev HMR doesn't open new
 * connections on every reload. DATABASE_URL is the Transaction pooler (6543); a Session-pooler URL
 * here exhausts pool_size under dev + HMR ("MaxClientsInSessionMode").
 *
 * Prisma connects as the table owner and bypasses RLS: every caller must resolve the member scope
 * first (src/lib/auth/scope.ts).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
  });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}
