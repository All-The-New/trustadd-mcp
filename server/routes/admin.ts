import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { requireAdmin } from "../lib/admin-audit.js";
import { handleAdminLogin, handleAdminSession, handleAdminLogout, requireAdminSession } from "../lib/admin-auth.js";
import { pool } from "../db.js";
import { storage } from "../storage.js";
import { runSync } from "../../scripts/sync-prod-to-dev.js";
import { getCommunityFeedbackScheduler, discoverAllSources } from "../community-feedback/index.js";
import { probeAllAgents } from "../x402-prober.js";
import { syncAllAgentTransactions } from "../transaction-indexer.js";
import { getReportUsageStats } from "../trust-report-compiler.js";
import { cached } from "./helpers.js";

const logger = createLogger("routes:admin");

let syncInProgress = false;

export function registerAdminRoutes(app: Express): void {
  app.post("/api/admin/sync", requireAdmin(), async (req, res) => {
    if (!process.env.PROD_DATABASE_URL || !process.env.DATABASE_URL) {
      return res.status(503).json({ message: "Database URLs not configured" });
    }

    if (syncInProgress) {
      return res.status(409).json({ message: "Sync already in progress" });
    }

    syncInProgress = true;
    res.json({ message: "Sync started", status: "running" });

    runSync(
      process.env.PROD_DATABASE_URL,
      process.env.DATABASE_URL,
      (msg) => logger.info(msg, { source: "sync" }),
    ).then(async (result) => {
      await storage.updateIndexerState(1, { lastSyncedAt: new Date() });
      logger.info("Sync complete", { agents: result.agents, events: result.events });
    }).catch((err) => {
      logger.error("Sync failed", { error: (err as Error).message });
    }).finally(() => {
      syncInProgress = false;
    });
  });

  app.post("/api/admin/community-feedback/scrape", requireAdmin(), async (req, res) => {
    const scheduler = getCommunityFeedbackScheduler();
    if (!scheduler) return res.status(503).json({ message: "Community feedback not initialized" });
    if (scheduler.isRunning()) return res.status(409).json({ message: "Scrape already in progress" });

    const platform = (req.query.platform as string) || "github";
    res.json({ message: `Scrape started for ${platform}`, status: "running" });

    scheduler.runPlatformScrape(platform).catch((err) => {
      logger.error("Manual community feedback scrape failed", { error: (err as Error).message });
    });
  });

  app.post("/api/admin/transactions/sync", requireAdmin(), async (req, res) => {
    try {
      res.json({ message: "Transaction sync started", status: "running" });
      syncAllAgentTransactions().catch((err) => {
        logger.error("Manual transaction sync failed", { error: (err as Error).message });
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to start transaction sync" });
    }
  });

  app.post("/api/admin/probes/run", requireAdmin(), async (req, res) => {
    try {
      res.json({ message: "Probe run started", status: "running" });
      probeAllAgents().catch((err) => {
        logger.error("Manual probe run failed", { error: (err as Error).message });
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to start probe run" });
    }
  });

  app.post("/api/admin/community-feedback/discover", requireAdmin(), async (req, res) => {
    try {
      const result = await discoverAllSources();
      res.json({ message: "Discovery complete", ...result });
    } catch (err) {
      res.status(500).json({ error: "Discovery failed" });
    }
  });

  app.get("/api/admin/audit-log", requireAdmin(), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const result = await pool.query(
        `SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT $1`,
        [limit],
      );
      res.json({ entries: result.rows });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // Admin: Trust product usage stats
  app.get("/api/admin/trust-product/stats", requireAdmin(), async (_req, res) => {
    try {
      const stats = await getReportUsageStats();
      res.json(stats);
    } catch (err) {
      logger.error("Error fetching trust product stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust product stats" });
    }
  });

  // ─── Admin Auth (cookie-based) ────────────────────────────────
  app.post("/api/admin/login", handleAdminLogin);
  app.get("/api/admin/session", handleAdminSession);
  app.post("/api/admin/logout", handleAdminLogout);

  // ─── Admin Dashboard API (session-protected) ──────────────────

  // Detailed API usage with hourly breakdown (admin-only, heavier queries)
  app.get("/api/admin/usage/detailed", requireAdminSession(), async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days as string) || 7, 90);
      const data = await cached(`admin:usage-detailed:${days}`, 60_000, async () => {
        const since = new Date(Date.now() - days * 86400000).toISOString();

        const [summary, topPaths, topUsers, hourly, statusBreakdown, slowEndpoints, countryBreakdown] = await Promise.all([
          pool.query(
            `SELECT count(*)::int as total_requests,
                    count(DISTINCT ip)::int as unique_ips,
                    count(DISTINCT date_trunc('day', ts))::int as active_days,
                    round(avg(duration_ms))::int as avg_duration_ms,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::int as p50_ms,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int as p95_ms,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::int as p99_ms,
                    count(*) FILTER (WHERE status_code >= 400)::int as error_count,
                    count(*) FILTER (WHERE status_code >= 500)::int as server_error_count,
                    max(ts) as last_request_at
             FROM api_request_log WHERE ts >= $1`,
            [since],
          ),
          pool.query(
            `SELECT path, count(*)::int as hits, count(DISTINCT ip)::int as unique_ips,
                    round(avg(duration_ms))::int as avg_ms,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int as p95_ms,
                    count(*) FILTER (WHERE status_code >= 400)::int as errors
             FROM api_request_log WHERE ts >= $1
             GROUP BY path ORDER BY hits DESC LIMIT 30`,
            [since],
          ),
          // Full IPs for admin (not masked)
          pool.query(
            `SELECT ip, count(*)::int as hits,
                    count(DISTINCT path)::int as endpoints_used,
                    count(DISTINCT date_trunc('day', ts))::int as active_days,
                    min(ts) as first_seen, max(ts) as last_seen,
                    mode() WITHIN GROUP (ORDER BY country) as country,
                    mode() WITHIN GROUP (ORDER BY user_agent) as user_agent
             FROM api_request_log WHERE ts >= $1 AND ip IS NOT NULL
             GROUP BY ip ORDER BY hits DESC LIMIT 50`,
            [since],
          ),
          pool.query(
            `SELECT date_trunc('hour', ts) as hour,
                    count(*)::int as requests,
                    count(DISTINCT ip)::int as unique_ips,
                    round(avg(duration_ms))::int as avg_ms,
                    count(*) FILTER (WHERE status_code >= 400)::int as errors
             FROM api_request_log WHERE ts >= $1
             GROUP BY hour ORDER BY hour`,
            [since],
          ),
          pool.query(
            `SELECT status_code, count(*)::int as count
             FROM api_request_log WHERE ts >= $1
             GROUP BY status_code ORDER BY count DESC`,
            [since],
          ),
          pool.query(
            `SELECT path, round(avg(duration_ms))::int as avg_ms,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int as p95_ms,
                    count(*)::int as hits
             FROM api_request_log WHERE ts >= $1
             GROUP BY path HAVING count(*) >= 5
             ORDER BY avg_ms DESC LIMIT 15`,
            [since],
          ),
          pool.query(
            `SELECT country, count(*)::int as hits, count(DISTINCT ip)::int as unique_ips
             FROM api_request_log WHERE ts >= $1 AND country IS NOT NULL
             GROUP BY country ORDER BY hits DESC LIMIT 20`,
            [since],
          ),
        ]);

        return {
          period: { days, since },
          summary: summary.rows[0],
          topPaths: topPaths.rows,
          topUsers: topUsers.rows,
          hourly: hourly.rows,
          statusBreakdown: statusBreakdown.rows,
          slowEndpoints: slowEndpoints.rows,
          countryBreakdown: countryBreakdown.rows,
        };
      });
      res.json(data);
    } catch (err) {
      logger.error("Error fetching admin usage details", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch usage details" });
    }
  });

  // Admin: recent raw log entries with pagination
  app.get("/api/admin/usage/log", requireAdminSession(), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const path = req.query.path as string | undefined;
      const ip = req.query.ip as string | undefined;
      const minStatus = parseInt(req.query.minStatus as string) || 0;

      const conditions = ["1=1"];
      const params: unknown[] = [];
      let paramIdx = 0;

      if (path) {
        paramIdx++;
        conditions.push(`path LIKE $${paramIdx}`);
        params.push(`%${path}%`);
      }
      if (ip) {
        paramIdx++;
        conditions.push(`ip = $${paramIdx}`);
        params.push(ip);
      }
      if (minStatus > 0) {
        paramIdx++;
        conditions.push(`status_code >= $${paramIdx}`);
        params.push(minStatus);
      }

      paramIdx++;
      params.push(limit);
      paramIdx++;
      params.push(offset);

      const result = await pool.query(
        `SELECT id, ts, method, path, status_code, duration_ms, ip, user_agent, referer, country
         FROM api_request_log
         WHERE ${conditions.join(" AND ")}
         ORDER BY ts DESC
         LIMIT $${paramIdx - 1} OFFSET $${paramIdx}`,
        params,
      );

      const countResult = await pool.query(
        `SELECT count(*)::int as total FROM api_request_log WHERE ${conditions.join(" AND ")}`,
        params.slice(0, params.length - 2),
      );

      res.json({ entries: result.rows, total: countResult.rows[0].total, limit, offset });
    } catch (err) {
      logger.error("Error fetching usage log", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch usage log" });
    }
  });

  // Admin: system overview for dashboard
  app.get("/api/admin/dashboard", requireAdminSession(), async (_req, res) => {
    try {
      const data = await cached("admin:dashboard", 30_000, async () => {
        const [stats, recentAudit, taskStatus, recentErrors, apiSummary] = await Promise.all([
          storage.getStats(),
          pool.query(
            `SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT 10`,
          ),
          pool.query(
            `SELECT chain_id, last_processed_block, is_running, last_error, last_synced_at, updated_at
             FROM indexer_state ORDER BY chain_id`,
          ),
          pool.query(
            `SELECT chain_id, event_type, message, created_at
             FROM indexer_events
             WHERE event_type IN ('error', 'timeout', 'connection_error')
             AND created_at >= NOW() - INTERVAL '24 hours'
             ORDER BY created_at DESC LIMIT 20`,
          ),
          pool.query(
            `SELECT count(*)::int as total_24h,
                    count(DISTINCT ip)::int as unique_ips_24h,
                    count(*) FILTER (WHERE status_code >= 500)::int as errors_24h,
                    round(avg(duration_ms))::int as avg_ms_24h
             FROM api_request_log WHERE ts >= NOW() - INTERVAL '24 hours'`,
          ),
        ]);

        return {
          stats,
          recentAuditEntries: recentAudit.rows,
          indexerStates: taskStatus.rows,
          recentErrors: recentErrors.rows,
          apiSummary: apiSummary.rows[0],
        };
      });
      res.json(data);
    } catch (err) {
      logger.error("Error fetching admin dashboard", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // Admin: audit log with filtering
  app.get("/api/admin/audit-log/detailed", requireAdminSession(), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const successFilter = req.query.success as string | undefined;

      const conditions = ["1=1"];
      const params: unknown[] = [];
      let idx = 0;

      if (successFilter === "true" || successFilter === "false") {
        idx++;
        conditions.push(`success = $${idx}`);
        params.push(successFilter === "true");
      }

      idx++;
      params.push(limit);
      idx++;
      params.push(offset);

      const result = await pool.query(
        `SELECT * FROM admin_audit_log
         WHERE ${conditions.join(" AND ")}
         ORDER BY timestamp DESC
         LIMIT $${idx - 1} OFFSET $${idx}`,
        params,
      );

      const countResult = await pool.query(
        `SELECT count(*)::int as total FROM admin_audit_log WHERE ${conditions.join(" AND ")}`,
        params.slice(0, params.length - 2),
      );

      res.json({ entries: result.rows, total: countResult.rows[0].total, limit, offset });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  app.post("/api/admin/mpp/probe-all", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "MPP probe started", status: "running" });
      const { probeAllAgentsForMpp } = await import("../mpp-prober.js");
      probeAllAgentsForMpp().catch((err) =>
        logger.error("Manual MPP probe failed", { error: (err as Error).message }),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to start MPP probe" });
    }
  });

  app.post("/api/admin/mpp/index-directory", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "MPP directory index started", status: "running" });
      (async () => {
        const { createDirectorySource } = await import("../mpp-directory.js");
        const mode = (process.env.MPP_DIRECTORY_SOURCE as "api" | "scrape" | "auto") || "auto";
        const source = createDirectorySource(mode);
        const services = await source.fetchServices();
        for (const s of services) {
          await storage.upsertMppDirectoryService({
            serviceUrl: s.serviceUrl,
            serviceName: s.serviceName,
            providerName: s.providerName,
            description: s.description,
            category: s.category,
            pricingModel: s.pricingModel,
            priceAmount: s.priceAmount,
            priceCurrency: s.priceCurrency,
            paymentMethods: s.paymentMethods as any,
            recipientAddress: s.recipientAddress,
            metadata: s.metadata,
          });
        }
      })().catch((err) => logger.error("Manual directory index failed", { error: (err as Error).message }));
    } catch (err) {
      res.status(500).json({ error: "Failed to start directory index" });
    }
  });

  app.post("/api/admin/mpp/index-tempo", requireAdmin(), async (_req, res) => {
    try {
      res.json({ message: "Tempo sync started", status: "running" });
      const { syncAllTempoTransactions } = await import("../tempo-transaction-indexer.js");
      syncAllTempoTransactions().catch((err) =>
        logger.error("Manual Tempo sync failed", { error: (err as Error).message }),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to start Tempo sync" });
    }
  });
}
