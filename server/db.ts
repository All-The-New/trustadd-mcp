import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const isPooler = process.env.DATABASE_URL.includes("pooler.supabase.com");
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: isPooler ? 3 : 8,
    idleTimeoutMillis: isPooler ? 5000 : 15000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
    keepAlive: !isPooler,
    keepAliveInitialDelayMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });
}

let _pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!_pool) {
    _pool = getPool();
    _pool.on("error", (err: Error) => {
      console.error(`[db] Pool client error (handled): ${err.message}`);
    });
  }
  return _pool;
}

// Lazy proxy: pool is created on first access
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getDbPool() as any)[prop];
  },
});

export const db = drizzle(pool, { schema });
