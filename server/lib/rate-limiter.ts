import type { Request, Response, NextFunction } from "express";
import { getDbPool } from "../db.js";
import { createLogger } from "./logger.js";

const logger = createLogger("rate-limit");

interface RateLimiterOptions {
  prefix: string;
  windowMs: number;
  limit: number;
}

/**
 * Database-backed rate limiter that works across Vercel serverless instances.
 * Uses raw pool.query() to avoid Drizzle's prepared statements (incompatible with Supabase transaction pooler).
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { prefix, windowMs, limit } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const key = `${prefix}:${ip}`;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

    try {
      const pool = getDbPool();

      const result = await pool.query(
        `INSERT INTO rate_limit_entries (key, window_start, hit_count)
         VALUES ($1, $2, 1)
         ON CONFLICT (key, window_start) DO UPDATE SET hit_count = rate_limit_entries.hit_count + 1
         RETURNING hit_count`,
        [key, windowStart],
      );

      const hitCount = result.rows[0].hit_count;
      const remaining = Math.max(0, limit - hitCount);
      const resetTime = Math.ceil((windowStart.getTime() + windowMs) / 1000);

      res.setHeader("RateLimit-Limit", limit);
      res.setHeader("RateLimit-Remaining", remaining);
      res.setHeader("RateLimit-Reset", resetTime);

      if (hitCount > limit) {
        const retryAfter = Math.ceil(windowMs / 1000);
        res.setHeader("Retry-After", retryAfter);
        return res.status(429).json({
          message: "Too many requests, please try again later.",
          retryAfter,
        });
      }

      // Stochastic cleanup: 1% chance per request
      if (Math.random() < 0.01) {
        pool.query(
          `DELETE FROM rate_limit_entries WHERE window_start < NOW() - INTERVAL '2 hours'`,
        ).catch(() => {});
      }

      next();
    } catch (err) {
      // If rate limiting fails (DB issue), allow the request through
      logger.warn("Rate limit check failed, allowing request", { error: (err as Error).message, key });
      next();
    }
  };
}
