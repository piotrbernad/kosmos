import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * HMR-safe Drizzle singleton. In dev, Next.js re-evaluates modules on every
 * save; without this cache we would spawn a new pg.Pool per edit and hit the
 * connection limit within minutes. In production, the pool is created once
 * per server process.
 */

declare global {
  var __drizzle: ReturnType<typeof buildDb> | undefined;
  var __pgPool: Pool | undefined;
}

function buildDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = globalThis.__pgPool ?? new Pool({ connectionString, max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgPool = pool;
  }
  return drizzle(pool, { schema });
}

export const db = globalThis.__drizzle ?? buildDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__drizzle = db;
}

export type Db = typeof db;
