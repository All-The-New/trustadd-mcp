import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
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
