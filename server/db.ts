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

const TRANSIENT_ERRORS = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE",
  "CONNECTION_CLOSED", "CONNECTION_ENDED",
]);

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as any).code;
  if (code && TRANSIENT_ERRORS.has(code)) return true;
  const msg = err.message.toLowerCase();
  return msg.includes("connection terminated") ||
    msg.includes("connection reset") ||
    msg.includes("socket hang up") ||
    msg.includes("client has encountered a connection error");
}

let _pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!_pool) {
    _pool = getPool();
    _pool.on("error", (err: Error) => {
      console.error(`[db] Pool client error (handled): ${err.message}`);
    });

    // Wrap pool.query with single retry on transient connection errors
    const originalQuery = _pool.query.bind(_pool);
    (_pool as any).query = async function retryQuery(...args: any[]) {
      try {
        return await (originalQuery as any)(...args);
      } catch (err) {
        if (isTransientError(err)) {
          console.warn(`[db] Transient error, retrying in 500ms: ${(err as Error).message}`);
          await new Promise(r => setTimeout(r, 500));
          return (originalQuery as any)(...args);
        }
        throw err;
      }
    };
  }
  return _pool;
}

// Lazy proxy: pool is created on first access
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getDbPool() as any)[prop];
  },
});

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    _db = drizzle(getDbPool(), { schema });
  }
  return _db;
}

// Lazy proxy: db is created on first access (avoids DATABASE_URL check at import time)
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
