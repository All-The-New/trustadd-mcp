import type { Request, Response, NextFunction } from "express";
import { getDbPool } from "../db.js";

/** Collapse dynamic path segments for meaningful aggregation. */
function normalizePath(path: string): string {
  return path
    // UUID segments
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    // Numeric IDs (standalone segments of 1+ digits)
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    // Hex addresses (0x + 40 chars)
    .replace(/0x[0-9a-fA-F]{40}/g, ":address")
    // ERC-8004 style IDs or other long alphanumeric slugs (8+ chars with mixed case/digits)
    .replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, "/:slug");
}

const SKIP_PATHS = new Set(["/api/health", "/api/analytics/api-usage"]);

/**
 * Lightweight Express middleware that logs API requests to the api_request_log table.
 * Fires asynchronously after the response is sent — never blocks the request.
 * Skips static assets, health checks, and the usage endpoint itself.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const path = req.path;

      // Skip noise: non-API, health, self, internal
      if (
        !path.startsWith("/api/") ||
        SKIP_PATHS.has(path) ||
        path.startsWith("/api/_")
      ) {
        return;
      }

      const durationMs = Date.now() - start;
      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      const userAgent = req.headers["user-agent"]?.substring(0, 512) || null;
      const referer = req.headers["referer"]?.substring(0, 512) || null;
      const country = req.headers["x-vercel-ip-country"]?.toString() || null;
      const normalizedPath = normalizePath(path);

      // Fire-and-forget — don't await, don't block
      const pool = getDbPool();
      pool.query(
        `INSERT INTO api_request_log (method, path, status_code, duration_ms, ip, user_agent, referer, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.method, normalizedPath, res.statusCode, durationMs, ip, userAgent, referer, country],
      ).catch(() => {
        // Silently ignore — logging should never take down the app
      });

      // Stochastic cleanup: 0.1% chance per request, drop rows older than 90 days
      if (Math.random() < 0.001) {
        pool.query(
          `DELETE FROM api_request_log WHERE ts < NOW() - INTERVAL '90 days'`,
        ).catch(() => {});
      }
    });

    next();
  };
}
