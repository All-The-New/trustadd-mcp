import type { Express } from "express";
import { type Server } from "http";
import { createLogger } from "./lib/logger.js";
import { requireAdmin } from "./lib/admin-audit.js";
import { handleAdminLogin, handleAdminSession, handleAdminLogout, requireAdminSession } from "./lib/admin-auth.js";
import { pool } from "./db.js";
import { storage } from "./storage.js";

const logger = createLogger("routes");
import { runSync } from "../scripts/sync-prod-to-dev.js";
import { getAllChains, getEnabledChains, getChain } from "../shared/chains.js";
import { evaluateAlerts, deliverAlerts } from "./alerts.js";
import { getCommunityFeedbackScheduler, discoverAllSources } from "./community-feedback/index.js";
import { recalculateScore } from "./trust-score.js";
import { probeAllAgents } from "./x402-prober.js";
import { syncAllAgentTransactions } from "./transaction-indexer.js";
import { createTrustProductGate } from "./lib/x402-gate.js";
import {
  resolveAgentByAddress,
  getOrCompileReport,
  incrementAccessCount,
  getReportUsageStats,
  computeVerdict,
  type QuickCheckData,
  type FullReportData,
  type Verdict,
} from "./trust-report-compiler.js";

// ─── API Tiering ─────────────────────────────────────────────────
// Free tier: ecosystem analytics, agent discovery (redacted), verdict badges
// Paid tier (x402): trust scores, breakdowns, community signals, transactions
// See docs/api-tiering.md for the full classification.

/** Strip trust-intelligence fields from an agent object for public (free) responses. */
function redactAgentForPublic(agent: Record<string, unknown>): Record<string, unknown> {
  const verdict = computeVerdict(
    (agent.trustScore as number) ?? 0,
    (agent.qualityTier as string) ?? null,
    (agent.spamFlags as string[]) ?? null,
    (agent.lifecycleStatus as string) ?? null,
  );
  const {
    trustScore: _ts,
    trustScoreBreakdown: _tsb,
    trustScoreUpdatedAt: _tsu,
    qualityTier: _qt,
    spamFlags: _sf,
    lifecycleStatus: _ls,
    ...publicFields
  } = agent;
  return {
    ...publicFields,
    verdict,
    reportAvailable: true,
  };
}

// ─── Rate Limiting ───────────────────────────────────────────────
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= maxRequests;
}

// Periodic cleanup of expired rate-limit buckets (every 5 min)
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(rateLimitBuckets.keys());
  for (const ip of keys) {
    const bucket = rateLimitBuckets.get(ip);
    if (bucket && bucket.resetAt <= now) rateLimitBuckets.delete(ip);
  }
}, 300_000);

// Lightweight in-memory TTL cache for expensive query results.
// Serverless functions are ephemeral, so memory is naturally bounded.
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > now) return entry.data as T;
  const data = await fn();
  responseCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

function parseChainId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = parseInt(raw as string, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function registerRoutes(
  app: Express,
  httpServer?: Server,
): Promise<void> {
  app.get("/sitemap-agents.xml", async (_req, res) => {
    try {
      const agentEntries = await storage.getAgentIdsForSitemap();
      const BASE_URL = "https://trustadd.com";
      const urls = agentEntries.map((a) => {
        const loc = `${BASE_URL}/agent/${a.slug ?? a.id}`;
        const lastmod = a.updatedAt ? a.updatedAt.toISOString().split("T")[0] : undefined;
        return `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      logger.error("Sitemap generation failed", { error: (err as Error).message });
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/api/chains", async (_req, res) => {
    try {
      const allChains = getAllChains();
      const enabledChains = getEnabledChains();
      const enabledIds = new Set(enabledChains.map((c) => c.chainId));

      const stats = await storage.getStats();
      const chainBreakdown = stats.chainBreakdown || [];

      const result = allChains.map((chain) => {
        const chainStats = chainBreakdown.find((c) => c.chainId === chain.chainId);
        return {
          chainId: chain.chainId,
          name: chain.name,
          shortName: chain.shortName,
          explorerUrl: chain.explorerUrl,
          explorerName: chain.explorerName,
          color: chain.color,
          bgColor: chain.bgColor,
          iconLetter: chain.iconLetter,
          enabled: enabledIds.has(chain.chainId),
          totalAgents: chainStats?.totalAgents ?? 0,
          lastProcessedBlock: chainStats?.lastProcessedBlock ?? 0,
          isRunning: chainStats?.isRunning ?? false,
          lastError: chainStats?.lastError ?? null,
        };
      });

      res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      res.json(result);
    } catch (err) {
      logger.error("Error fetching chains", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch chains" });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      // Rate limit: 10 requests per minute per IP
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
      if (!checkRateLimit(`agents-list:${clientIp}`, 60_000, 10)) {
        res.set("Retry-After", "60");
        return res.status(429).json({ message: "Rate limit exceeded. Max 10 requests per minute." });
      }

      const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 20) : undefined;
      const offset = req.query.offset ? Math.max(parseInt(req.query.offset as string, 10) || 0, 0) : undefined;
      const search = req.query.search as string | undefined;
      const filter = req.query.filter as "all" | "claimed" | "unclaimed" | "has-metadata" | "x402-enabled" | "has-reputation" | "has-feedback" | undefined;
      const chainId = parseChainId(req.query.chainId);
      // "trust-score" sort is no longer available on the free tier — fall back to "newest"
      const rawSort = req.query.sort as string | undefined;
      const sort = rawSort === "trust-score" ? "newest" as const : rawSort as "newest" | "oldest" | "name" | undefined;
      const excludeSpam = req.query.excludeSpam === "true" ? true : undefined;
      const result = await storage.getAgents({ limit, offset, search, filter, chainId, sort, excludeSpam });

      // Redact trust fields from each agent in the list
      const redactedAgents = result.agents.map((a: Record<string, unknown>) => redactAgentForPublic(a));

      res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
      res.set("X-TrustAdd-Tier", "free");
      res.json({ ...result, agents: redactedAgents });
    } catch (err) {
      logger.error("Error fetching agents", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
      res.set("X-TrustAdd-Tier", "free");
      res.json(redactAgentForPublic(agent as unknown as Record<string, unknown>));
    } catch (err) {
      logger.error("Error fetching agent", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Gated: per-agent on-chain history is paid intelligence
  app.get("/api/agents/:id/history", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "Agent on-chain history is available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
        paymentToken: "USDC",
      });
    } catch (err) {
      logger.error("Error fetching agent history", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent history" });
    }
  });

  app.get("/api/events/recent", async (req, res) => {
    try {
      const parsed = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const limit = Number.isNaN(parsed) ? 20 : parsed;
      const chainId = parseChainId(req.query.chainId);
      const events = await storage.getRecentEvents(limit, chainId);
      res.json(events);
    } catch (err) {
      logger.error("Error fetching recent events", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch recent events" });
    }
  });

  app.get("/api/agents/:id/feedback", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      const summary = await storage.getAgentFeedbackSummary(agent.id, agent.controllerAddress);
      res.json(summary);
    } catch (err) {
      logger.error("Error fetching agent feedback", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent feedback" });
    }
  });

  // NOT READY — returns empty until real oracle addresses are configured in known-reputation-sources.ts
  app.get("/api/reputation-sources", (_req, res) => {
    res.json({});
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const chainId = parseChainId(req.query.chainId);
      const cacheKey = `stats:${chainId ?? "all"}`;
      const stats = await cached(cacheKey, 30_000, () => storage.getStats(chainId));
      res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      res.json(stats);
    } catch (err) {
      logger.error("Error fetching stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Analytics endpoints — cached 300s in-memory + 300s at Vercel edge
  const ANALYTICS_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
  const ANALYTICS_TTL = 300_000;

  app.get("/api/analytics/overview", async (_req, res) => {
    try {
      const data = await cached("analytics:overview", ANALYTICS_TTL, () => storage.getAnalyticsOverview());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching analytics overview", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  app.get("/api/analytics/protocol-stats", async (_req, res) => {
    try {
      const data = await cached("analytics:protocol-stats", ANALYTICS_TTL, () => storage.getProtocolStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching protocol stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch protocol stats" });
    }
  });

  app.get("/api/analytics/chain-distribution", async (_req, res) => {
    try {
      const data = await cached("analytics:chain-distribution", ANALYTICS_TTL, () => storage.getAnalyticsChainDistribution());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching chain distribution", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch chain distribution" });
    }
  });

  app.get("/api/analytics/registrations", async (_req, res) => {
    try {
      const data = await cached("analytics:registrations", ANALYTICS_TTL, () => storage.getAnalyticsRegistrations());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching registrations", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  app.get("/api/analytics/metadata-quality", async (_req, res) => {
    try {
      const data = await cached("analytics:metadata-quality", ANALYTICS_TTL, () => storage.getAnalyticsMetadataQuality());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching metadata quality", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch metadata quality" });
    }
  });

  app.get("/api/analytics/x402-by-chain", async (_req, res) => {
    try {
      const data = await cached("analytics:x402-by-chain", ANALYTICS_TTL, () => storage.getAnalyticsX402ByChain());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching x402 by chain", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch x402 by chain" });
    }
  });

  app.get("/api/analytics/controller-concentration", async (_req, res) => {
    try {
      const data = await cached("analytics:controller-concentration", ANALYTICS_TTL, () => storage.getAnalyticsControllerConcentration());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching controller concentration", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch controller concentration" });
    }
  });

  app.get("/api/analytics/uri-schemes", async (_req, res) => {
    try {
      const data = await cached("analytics:uri-schemes", ANALYTICS_TTL, () => storage.getAnalyticsUriSchemes());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching URI schemes", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch URI schemes" });
    }
  });

  app.get("/api/analytics/categories", async (_req, res) => {
    try {
      const data = await cached("analytics:categories", ANALYTICS_TTL, () => storage.getAnalyticsCategories());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching categories", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/analytics/image-domains", async (_req, res) => {
    try {
      const data = await cached("analytics:image-domains", ANALYTICS_TTL, () => storage.getAnalyticsImageDomains());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching image domains", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch image domains" });
    }
  });

  app.get("/api/analytics/models", async (_req, res) => {
    try {
      const data = await cached("analytics:models", ANALYTICS_TTL, () => storage.getAnalyticsModels());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching models", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/analytics/endpoints-coverage", async (_req, res) => {
    try {
      const data = await cached("analytics:endpoints-coverage", ANALYTICS_TTL, () => storage.getAnalyticsEndpointsCoverage());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching endpoints coverage", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch endpoints coverage" });
    }
  });

  app.get("/api/analytics/top-agents", async (_req, res) => {
    try {
      const data = await cached("analytics:top-agents", ANALYTICS_TTL, () => storage.getAnalyticsTopAgents());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching top agents", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  // --- API Usage Analytics ---

  app.get("/api/analytics/api-usage", async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days as string) || 7, 90);
      const data = await cached(`analytics:api-usage:${days}`, ANALYTICS_TTL, async () => {
        const since = new Date(Date.now() - days * 86400000).toISOString();

        const [summary, topPaths, topUsers, daily] = await Promise.all([
          // Overall summary
          pool.query(
            `SELECT count(*)::int as total_requests,
                    count(DISTINCT ip)::int as unique_ips,
                    count(DISTINCT date_trunc('day', ts))::int as active_days,
                    round(avg(duration_ms))::int as avg_duration_ms,
                    count(*) FILTER (WHERE status_code >= 400)::int as error_count
             FROM api_request_log WHERE ts >= $1`,
            [since],
          ),
          // Top endpoints
          pool.query(
            `SELECT path, count(*)::int as hits, count(DISTINCT ip)::int as unique_ips,
                    round(avg(duration_ms))::int as avg_ms
             FROM api_request_log WHERE ts >= $1
             GROUP BY path ORDER BY hits DESC LIMIT 20`,
            [since],
          ),
          // Top users (by IP) — anonymize last octet for privacy
          pool.query(
            `SELECT regexp_replace(ip, '\\d+$', 'x') as ip_masked,
                    count(*)::int as hits,
                    count(DISTINCT path)::int as endpoints_used,
                    count(DISTINCT date_trunc('day', ts))::int as active_days,
                    min(ts) as first_seen, max(ts) as last_seen,
                    mode() WITHIN GROUP (ORDER BY country) as country
             FROM api_request_log WHERE ts >= $1 AND ip IS NOT NULL
             GROUP BY ip ORDER BY hits DESC LIMIT 20`,
            [since],
          ),
          // Daily traffic
          pool.query(
            `SELECT date_trunc('day', ts)::date as day,
                    count(*)::int as requests,
                    count(DISTINCT ip)::int as unique_ips
             FROM api_request_log WHERE ts >= $1
             GROUP BY day ORDER BY day`,
            [since],
          ),
        ]);

        return {
          period: { days, since },
          summary: summary.rows[0],
          topPaths: topPaths.rows,
          topUsers: topUsers.rows,
          daily: daily.rows,
        };
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching API usage analytics", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch API usage analytics" });
    }
  });

  let syncInProgress = false;

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

  app.get("/api/health", async (_req, res) => {
    try {
      const enabledChains = getEnabledChains();
      const alerts = await evaluateAlerts();
      deliverAlerts(alerts).catch(() => {});

      const chains = [];
      let chainsRunning = 0;
      let chainsWithErrors = 0;

      for (const chain of enabledChains) {
        const state = await storage.getIndexerState(chain.chainId);
        const minutesStale = (Date.now() - state.updatedAt.getTime()) / 60_000;
        const isActive = minutesStale < 10;
        if (isActive) chainsRunning++;
        if (state.lastError) chainsWithErrors++;
        chains.push({
          chainId: chain.chainId,
          name: chain.name,
          status: isActive ? (state.lastError ? "degraded" : "healthy") : "down",
          lastBlock: state.lastProcessedBlock,
        });
      }

      const totalChains = enabledChains.length;
      const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
      let status: "healthy" | "degraded" | "unhealthy";
      if (chainsRunning === 0 || chainsRunning < totalChains / 2 || criticalAlerts > 0) {
        status = "unhealthy";
      } else if (chainsWithErrors > 0 || chainsRunning < totalChains) {
        status = "degraded";
      } else {
        status = "healthy";
      }

      const activeAlerts = alerts.length;
      const httpStatus = status === "unhealthy" ? 503 : 200;

      res.status(httpStatus).json({
        status,
        chains,
        activeAlerts,
        criticalAlerts,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({ status: "unknown", error: "Health check failed" });
    }
  });

  app.get("/api/status/overview", async (_req, res) => {
    try {
      const enabledChains = getEnabledChains();
      const chainStatuses = [];

      for (const chain of enabledChains) {
        const state = await storage.getIndexerState(chain.chainId);
        const eventCounts = await storage.getIndexerEventCounts(60, chain.chainId);
        const completedCount = eventCounts.find(e => e.eventType === "cycle_complete")?.count || 0;
        const errorTypes = ["error", "rate_limit", "timeout", "connection_error"];
        const failedCount = eventCounts.filter(e => errorTypes.includes(e.eventType)).reduce((sum, e) => sum + e.count, 0);

        chainStatuses.push({
          chainId: chain.chainId,
          name: chain.name,
          shortName: chain.shortName,
          isRunning: state.isRunning,
          lastBlock: state.lastProcessedBlock,
          lastError: state.lastError,
          updatedAt: state.updatedAt.toISOString(),
          cyclesCompleted: completedCount,
          cyclesFailed: failedCount,
        });
      }

      res.json({ chains: chainStatuses });
    } catch (err) {
      res.status(500).json({ error: "Failed to get status overview" });
    }
  });

  app.get("/api/status/events", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const chainId = parseChainId(req.query.chainId);
      const eventType = req.query.eventType as string | undefined;
      const events = await storage.getRecentIndexerEvents(limit, chainId, eventType || undefined);
      res.json({ events });
    } catch (err) {
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  app.get("/api/status/metrics", async (req, res) => {
    try {
      const chainId = parseChainId(req.query.chainId);
      const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);
      const metrics = await storage.getMetricsHistory(chainId, hours);
      res.json({ metrics });
    } catch (err) {
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  app.get("/api/status/summary", async (_req, res) => {
    try {
      const summary = await storage.getStatusSummary();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: "Failed to get status summary" });
    }
  });

  app.get("/api/status/tasks", async (_req, res) => {
    try {
      const triggerKey = process.env.TRIGGER_SECRET_KEY;
      if (!triggerKey) {
        res.json({ error: "TRIGGER_SECRET_KEY not configured", tasks: [] });
        return;
      }

      const taskIds = [
        "blockchain-indexer",
        "chain-indexer",
        "watchdog",
        "recalculate-scores",
        "transaction-indexer",
        "community-feedback",
        "x402-prober",
      ];

      type RunEntry = {
        id: string; status: string; taskIdentifier: string;
        createdAt: string; finishedAt?: string; durationMs?: number;
        isSuccess?: boolean; isFailed?: boolean; costInCents?: number;
        tags?: string[];
      };

      // Fetch runs per task in parallel — ensures infrequent tasks appear
      const perTaskFetches = taskIds.map(async (taskId) => {
        try {
          const url = `https://api.trigger.dev/api/v1/runs?filter[taskIdentifier]=${taskId}&page[size]=10`;
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${triggerKey}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp.ok) return [];
          const json = await resp.json() as { data: RunEntry[] };
          return json.data || [];
        } catch {
          return [];
        }
      });

      const allResults = await Promise.all(perTaskFetches);
      const allRuns = allResults.flat();

      // Get latest run per task
      const taskMap = new Map<string, {
        taskId: string; lastRunId: string; lastStatus: string;
        lastRunAt: string; lastDurationMs: number; lastCostCents: number;
        recentSuccesses: number; recentFailures: number; tags?: string[];
      }>();

      for (const run of allRuns) {
        const task = run.taskIdentifier;

        if (!taskMap.has(task)) {
          taskMap.set(task, {
            taskId: task,
            lastRunId: run.id,
            lastStatus: run.status,
            lastRunAt: run.createdAt,
            lastDurationMs: run.durationMs || 0,
            lastCostCents: run.costInCents || 0,
            recentSuccesses: 0,
            recentFailures: 0,
            tags: run.tags,
          });
        }

        const entry = taskMap.get(task)!;
        if (run.isSuccess) entry.recentSuccesses++;
        if (run.isFailed) entry.recentFailures++;
      }

      res.json({
        tasks: Array.from(taskMap.values()),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to fetch task status", { error: (err as Error).message });
      res.status(500).json({ error: "Failed to fetch task status" });
    }
  });

  app.get("/api/status/alerts", async (_req, res) => {
    try {
      const alerts = await evaluateAlerts();
      deliverAlerts(alerts).catch(() => {});
      res.json({ alerts });
    } catch (err) {
      res.status(500).json({ error: "Failed to evaluate alerts" });
    }
  });

  // Gated: per-agent community feedback is paid intelligence (available in Full Report)
  app.get("/api/agents/:id/community-feedback", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      // Return a teaser with source availability, but no detail
      const summary = await storage.getCommunityFeedbackSummary(agent.id);
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "Community feedback details are available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        preview: {
          totalSources: summary?.totalSources ?? 0,
          hasGithub: (summary?.githubStars ?? 0) > 0 || (summary?.githubHealthScore ?? 0) > 0,
          hasFarcaster: (summary?.farcasterFollowers ?? 0) > 0,
        },
        quickCheckPrice: "$0.01",
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
        paymentToken: "USDC",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to get community feedback" });
    }
  });

  app.get("/api/agents/:id/community-feedback/github", async (req, res) => {
    const agent = await storage.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.set("X-TrustAdd-Tier", "gated");
    res.status(402).json({
      message: "GitHub signals are available in the Full Trust Report ($0.05 USDC via x402).",
      endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
      fullReportPrice: "$0.05",
      paymentNetwork: "eip155:8453",
    });
  });

  app.get("/api/agents/:id/community-feedback/farcaster", async (req, res) => {
    const agent = await storage.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.set("X-TrustAdd-Tier", "gated");
    res.status(402).json({
      message: "Farcaster signals are available in the Full Trust Report ($0.05 USDC via x402).",
      endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
      fullReportPrice: "$0.05",
      paymentNetwork: "eip155:8453",
    });
  });

  app.get("/api/community-feedback/stats", async (_req, res) => {
    try {
      const stats = await storage.getCommunityFeedbackStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to get community feedback stats" });
    }
  });

  // Free tier: community leaderboard shows names and verdict only, no detailed metrics
  app.get("/api/community-feedback/leaderboard", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const summaries = await storage.getAgentsWithCommunityFeedback(limit, offset);
      // Redact: show only name, chain, verdict — no community metrics
      const redacted = (summaries as any[]).map((entry: any) => ({
        agentId: entry.agentId,
        agentName: entry.agentName ?? entry.name ?? null,
        agentSlug: entry.agentSlug ?? entry.slug ?? null,
        chainId: entry.chainId,
        imageUrl: entry.imageUrl ?? null,
        hasCommunitySignals: true,
      }));
      res.set("X-TrustAdd-Tier", "free");
      res.json({ leaderboard: redacted });
    } catch (err) {
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
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

  // Free tier: verdict only. Full score/breakdown available via x402 trust report.
  app.get("/api/agents/:id/trust-score", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const verdict = computeVerdict(
        agent.trustScore ?? 0,
        agent.qualityTier ?? null,
        agent.spamFlags ?? null,
        agent.lifecycleStatus ?? null,
      );

      res.set("X-TrustAdd-Tier", "free");
      res.json({
        verdict,
        updatedAt: agent.trustScoreUpdatedAt ?? null,
        reportAvailable: true,
        quickCheckPrice: "$0.01",
        fullReportPrice: "$0.05",
        message: "Full trust score and breakdown available via x402 Trust Report. See /api/v1/trust/:address",
      });
    } catch (err) {
      logger.error("Error fetching trust score", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust score" });
    }
  });

  // Free tier: leaderboard shows names + verdicts only, no numeric scores
  app.get("/api/trust-scores/top", async (req, res) => {
    try {
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 20) : 20;
      const chainId = parseChainId(req.query.chain);
      const leaderboard = await storage.getTrustScoreLeaderboard(limit, chainId);
      // Redact: strip numeric scores, show verdict only
      const redacted = (leaderboard as any[]).map((entry: any) => {
        const verdict = computeVerdict(
          entry.trustScore ?? 0,
          entry.qualityTier ?? null,
          entry.spamFlags ?? null,
          entry.lifecycleStatus ?? null,
        );
        return {
          id: entry.id,
          name: entry.name,
          slug: entry.slug,
          chainId: entry.chainId,
          imageUrl: entry.imageUrl,
          verdict,
        };
      });
      res.set("X-TrustAdd-Tier", "free");
      res.json(redacted);
    } catch (err) {
      logger.error("Error fetching trust score leaderboard", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/trust-scores/distribution", async (req, res) => {
    try {
      const chainId = parseChainId(req.query.chain);
      const distribution = await storage.getTrustScoreDistribution(chainId);
      res.json(distribution);
    } catch (err) {
      logger.error("Error fetching trust score distribution", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch distribution" });
    }
  });

  // Free tier: aggregate score distribution and chain stats (no per-agent scores)
  app.get("/api/analytics/trust-scores", async (req, res) => {
    try {
      const [distribution, byChain] = await Promise.all([
        storage.getTrustScoreDistribution(),
        storage.getTrustScoreStatsByChain(),
      ]);
      res.set("X-TrustAdd-Tier", "free");
      res.json({ distribution, byChain });
    } catch (err) {
      logger.error("Error fetching trust score analytics", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust score analytics" });
    }
  });

  app.get("/api/economy/overview", async (_req, res) => {
    try {
      const overview = await storage.getEconomyOverview();
      res.json(overview);
    } catch (err) {
      logger.error("Error fetching economy overview", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch economy overview" });
    }
  });

  app.get("/api/economy/top-agents", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
      const chainId = parseChainId(req.query.chain);
      const topAgents = await storage.getTopX402Agents(limit, chainId);
      res.json(topAgents);
    } catch (err) {
      logger.error("Error fetching top x402 agents", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  app.get("/api/economy/endpoints", async (_req, res) => {
    try {
      const analysis = await storage.getEndpointAnalysis();
      res.json(analysis);
    } catch (err) {
      logger.error("Error fetching endpoint analysis", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch endpoint analysis" });
    }
  });

  app.get("/api/economy/chain-breakdown", async (_req, res) => {
    try {
      const breakdown = await storage.getX402AdoptionByChain();
      res.json(breakdown);
    } catch (err) {
      logger.error("Error fetching chain breakdown", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch chain breakdown" });
    }
  });

  app.get("/api/economy/probes", async (_req, res) => {
    try {
      const stats = await storage.getProbeStats();
      res.json(stats);
    } catch (err) {
      logger.error("Error fetching probe stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch probe stats" });
    }
  });

  // Gated: per-agent payment addresses are part of the paid trust intelligence
  app.get("/api/economy/payment-addresses", (_req, res) => {
    res.set("X-TrustAdd-Tier", "gated");
    res.status(402).json({
      message: "Per-agent payment address data is available in the Full Trust Report ($0.05 USDC via x402).",
      fullReportPrice: "$0.05",
      paymentNetwork: "eip155:8453",
      paymentToken: "USDC",
    });
  });

  app.get("/api/economy/transactions/stats", async (_req, res) => {
    try {
      const stats = await storage.getTransactionStats();
      res.json(stats);
    } catch (err) {
      logger.error("Error fetching transaction stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch transaction stats" });
    }
  });

  app.get("/api/economy/transactions/recent", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const transactions = await storage.getTransactions({ limit });
      res.json(transactions);
    } catch (err) {
      logger.error("Error fetching recent transactions", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  app.get("/api/economy/transactions/volume", async (req, res) => {
    try {
      const period = (req.query.period as string) || "30d";
      const volume = await storage.getTransactionVolume(period);
      res.json(volume);
    } catch (err) {
      logger.error("Error fetching transaction volume", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch transaction volume" });
    }
  });

  // Free tier: top earners with agent name + chain only, no IDs/addresses/scores
  app.get("/api/economy/transactions/top-earners", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 20);
      const topEarners = await storage.getTopEarningAgents(limit);
      const redacted = (topEarners as any[]).map((entry: any, idx: number) => ({
        rank: idx + 1,
        name: entry.agentName ?? entry.name ?? "Unknown Agent",
        chainId: entry.chainId,
      }));
      res.set("X-TrustAdd-Tier", "free");
      res.json(redacted);
    } catch (err) {
      logger.error("Error fetching top earners", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top earners" });
    }
  });

  // Gated: per-agent transaction history is paid intelligence
  app.get("/api/agents/:id/transactions", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "Agent transaction history is available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
        paymentToken: "USDC",
      });
    } catch (err) {
      logger.error("Error fetching agent transactions", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent transactions" });
    }
  });

  app.get("/api/agents/:id/transactions/stats", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "Agent transaction stats are available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
        paymentToken: "USDC",
      });
    } catch (err) {
      logger.error("Error fetching agent transaction stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent transaction stats" });
    }
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

  app.get("/api/quality/summary", async (_req, res) => {
    try {
      const summary = await storage.getQualitySummary();
      res.json(summary);
    } catch (err) {
      logger.error("Error fetching quality summary", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch quality summary" });
    }
  });

  // Removed: per-agent quality offender data is gated (exposes spam flags per agent)
  app.get("/api/quality/offenders", (_req, res) => {
    res.set("X-TrustAdd-Tier", "gated");
    res.status(402).json({
      message: "Per-agent quality analysis is available via the Trust Report API.",
      quickCheckPrice: "$0.01",
      fullReportPrice: "$0.05",
      paymentNetwork: "eip155:8453",
    });
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

  app.get("/api/skills/summary", async (_req, res) => {
    try {
      const data = await storage.getSkillsSummary();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching skills summary", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch skills summary" });
    }
  });

  app.get("/api/skills/chain-distribution", async (_req, res) => {
    try {
      const data = await storage.getSkillsChainDistribution();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching skills chain distribution", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch skills chain distribution" });
    }
  });

  app.get("/api/skills/top-capabilities", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
      const data = await storage.getSkillsTopCapabilities(limit);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching top capabilities", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top capabilities" });
    }
  });

  app.get("/api/skills/category-breakdown", async (_req, res) => {
    try {
      const data = await storage.getSkillsCategoryBreakdown();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching category breakdown", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch category breakdown" });
    }
  });

  app.get("/api/skills/trust-correlation", async (_req, res) => {
    try {
      const data = await storage.getSkillsTrustCorrelation();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching trust correlation", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust correlation" });
    }
  });

  app.get("/api/skills/oasf-overview", async (_req, res) => {
    try {
      const data = await storage.getSkillsOasfOverview();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching OASF overview", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch OASF overview" });
    }
  });

  app.get("/api/skills/notable-agents", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const data = await storage.getSkillsNotableAgents(limit);
      res.json(data);
    } catch (err) {
      logger.error("Error fetching notable agents", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch notable agents" });
    }
  });

  // --- Bazaar (x402 marketplace analytics) ---

  app.get("/api/bazaar/stats", async (_req, res) => {
    try {
      const data = await cached("bazaar:stats", 300_000, () => storage.getBazaarStats());
      res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching bazaar stats", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch bazaar stats" });
    }
  });

  app.get("/api/bazaar/services", async (req, res) => {
    try {
      const opts = {
        category: req.query.category as string | undefined,
        network: req.query.network as string | undefined,
        search: req.query.search as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };
      const data = await storage.getBazaarServices(opts);
      res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching bazaar services", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch bazaar services" });
    }
  });

  app.get("/api/bazaar/trends", async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days as string) || 90, 365);
      const data = await cached(`bazaar:trends:${days}`, 300_000, () => storage.getBazaarSnapshots(days));
      res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching bazaar trends", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch bazaar trends" });
    }
  });

  app.get("/api/bazaar/top-services", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const data = await cached(`bazaar:top:${limit}`, 300_000, () => storage.getBazaarTopServices(limit));
      res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching bazaar top services", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch bazaar top services" });
    }
  });

  app.get("/api/bazaar/price-distribution", async (_req, res) => {
    try {
      const data = await cached("bazaar:price-dist", 300_000, async () => {
        const { db } = await import("./db.js");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          SELECT
            CASE
              WHEN price_usd < 0.001 THEN 'Under $0.001'
              WHEN price_usd < 0.01 THEN '$0.001 - $0.01'
              WHEN price_usd < 0.1 THEN '$0.01 - $0.10'
              WHEN price_usd < 1 THEN '$0.10 - $1.00'
              WHEN price_usd < 10 THEN '$1.00 - $10.00'
              ELSE '$10.00+'
            END AS bucket,
            COUNT(*)::int AS count,
            CASE
              WHEN price_usd < 0.001 THEN 0
              WHEN price_usd < 0.01 THEN 1
              WHEN price_usd < 0.1 THEN 2
              WHEN price_usd < 1 THEN 3
              WHEN price_usd < 10 THEN 4
              ELSE 5
            END AS sort_order
          FROM bazaar_services
          WHERE is_active = TRUE AND price_usd IS NOT NULL AND price_usd > 0
          GROUP BY bucket, sort_order
          ORDER BY sort_order
        `);
        return (result.rows as any[]).map(r => ({
          bucket: r.bucket,
          count: Number(r.count),
        }));
      });
      res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching price distribution", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch price distribution" });
    }
  });

  app.get("/api/bazaar/crossref", async (_req, res) => {
    try {
      const data = await cached("bazaar:crossref", 300_000, async () => {
        const { db } = await import("./db.js");
        const { sql } = await import("drizzle-orm");
        // Find bazaar services whose payTo address matches a TrustAdd agent's
        // payment address (from x402 probes) or controller address
        const result = await db.execute(sql`
          SELECT DISTINCT ON (bs.pay_to)
            bs.pay_to,
            bs.name AS service_name,
            bs.category,
            bs.price_usd,
            a.id AS agent_id,
            a.name AS agent_name,
            a.slug AS agent_slug,
            a.chain_id,
            a.trust_score,
            a.image_url,
            'payment_address' AS match_type
          FROM bazaar_services bs
          INNER JOIN x402_probes xp ON LOWER(xp.payment_address) = LOWER(bs.pay_to)
          INNER JOIN agents a ON a.id = xp.agent_id
          WHERE bs.is_active = TRUE AND bs.pay_to IS NOT NULL
            AND (a.quality_tier IS NULL OR a.quality_tier NOT IN ('spam', 'archived'))
          ORDER BY bs.pay_to, a.trust_score DESC NULLS LAST
          LIMIT 50
        `);
        return (result.rows as any[]).map(r => ({
          serviceName: r.service_name,
          category: r.category,
          priceUsd: r.price_usd != null ? Number(r.price_usd) : null,
          agentName: r.agent_name,
          agentSlug: r.agent_slug,
          chainId: Number(r.chain_id),
          imageUrl: r.image_url,
          matchType: r.match_type,
        }));
      });
      res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (err) {
      logger.error("Error fetching bazaar crossref", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch bazaar crossref" });
    }
  });

  // === Trust Data Product API v1 (x402-gated) ===

  const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

  const trustProductEnabled = process.env.TRUST_PRODUCT_ENABLED?.toLowerCase() === "true";

  // Free endpoint — registered before the x402 gate. The gate's route regex only
  // matches /:address and /:address/report (not /:address/exists), so registration
  // order is belt-and-suspenders here.
  app.get("/api/v1/trust/:address/exists", async (req, res) => {
    try {
      const { address } = req.params;
      if (!ADDRESS_REGEX.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      const agent = await resolveAgentByAddress(address);
      if (!agent) {
        return res.json({
          found: false,
          name: null,
          verdict: "UNKNOWN",
          x402Required: true,
          quickCheckPrice: "$0.01",
          fullReportPrice: "$0.05",
          paymentNetwork: "eip155:8453",
          paymentToken: "USDC",
        });
      }

      // Use the same verdict logic as the paid endpoints
      const verdict = computeVerdict(
        agent.trustScore ?? 0,
        agent.qualityTier ?? null,
        agent.spamFlags ?? null,
        agent.lifecycleStatus ?? null,
      );

      res.json({
        found: true,
        name: agent.name,
        verdict,
        x402Required: true,
        quickCheckPrice: "$0.01",
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
        paymentToken: "USDC",
      });
    } catch (err) {
      logger.error("Trust exists check failed", { error: (err as Error).message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // x402 payment gate — mounted globally because the x402 middleware uses req.path
  // for route matching, and Express strips the mount prefix when using app.use(prefix, fn).
  if (trustProductEnabled) {
    const gate = createTrustProductGate();
    if (gate) {
      app.use(gate);
      logger.info("Trust Data Product x402 gate active");
    }
  }

  // Paid: Quick Check ($0.01 USDC via x402)
  app.get("/api/v1/trust/:address", async (req, res) => {
    try {
      // Guard: if gate is not active, don't serve paid data for free
      if (!trustProductEnabled) {
        return res.status(503).json({ message: "Trust Data Product is not enabled" });
      }

      const { address } = req.params;
      if (!ADDRESS_REGEX.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      const chainId = parseChainId(req.query.chainId);
      const result = await getOrCompileReport(address, chainId);

      if (!result) {
        return res.status(404).json({
          verdict: "UNKNOWN",
          message: "No agent found for this address",
        });
      }

      incrementAccessCount(result.report.id, "quick");

      res.set("Cache-Control", "no-store");
      res.json(result.report.quickCheckData as QuickCheckData);
    } catch (err) {
      logger.error("Trust quick check failed", { error: (err as Error).message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Paid: Full Report ($0.05 USDC via x402)
  app.get("/api/v1/trust/:address/report", async (req, res) => {
    try {
      if (!trustProductEnabled) {
        return res.status(503).json({ message: "Trust Data Product is not enabled" });
      }

      const { address } = req.params;
      if (!ADDRESS_REGEX.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      const chainId = parseChainId(req.query.chainId);
      const result = await getOrCompileReport(address, chainId);

      if (!result) {
        return res.status(404).json({
          verdict: "UNKNOWN",
          message: "No agent found for this address",
        });
      }

      incrementAccessCount(result.report.id, "full");

      res.set("Cache-Control", "no-store");
      res.json(result.report.fullReportData as FullReportData);
    } catch (err) {
      logger.error("Trust full report failed", { error: (err as Error).message });
      res.status(500).json({ message: "Internal error" });
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

}
