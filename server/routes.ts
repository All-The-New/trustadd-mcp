import type { Express } from "express";
import { type Server } from "http";
import { createLogger } from "./lib/logger.js";
import { requireAdmin } from "./lib/admin-audit.js";
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
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const search = req.query.search as string | undefined;
      const filter = req.query.filter as "all" | "claimed" | "unclaimed" | "has-metadata" | "x402-enabled" | "has-reputation" | "has-feedback" | undefined;
      const chainId = parseChainId(req.query.chainId);
      const sort = req.query.sort as "newest" | "oldest" | "trust-score" | "name" | undefined;
      const minTrustScore = req.query.minTrustScore ? parseInt(req.query.minTrustScore as string, 10) : undefined;
      const excludeSpam = req.query.excludeSpam === "true" ? true : undefined;
      const result = await storage.getAgents({ limit, offset, search, filter, chainId, sort, minTrustScore, excludeSpam });

      const agentIds = result.agents.map((a: { id: string }) => a.id);
      const summaries = agentIds.length > 0
        ? await storage.getCommunityFeedbackSummariesByAgentIds(agentIds)
        : [];
      const feedbackMap: Record<string, { githubStars: number | null; githubHealthScore: number | null; farcasterFollowers: number | null }> = {};
      for (const s of summaries) {
        feedbackMap[s.agentId] = { githubStars: s.githubStars, githubHealthScore: s.githubHealthScore, farcasterFollowers: s.farcasterFollowers };
      }

      res.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
      res.json({ ...result, communityFeedback: feedbackMap });
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
      res.json(agent);
    } catch (err) {
      logger.error("Error fetching agent", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.get("/api/agents/:id/history", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      const events = await storage.getAgentEvents(agent.id);
      res.json(events);
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
        if (state.isRunning) chainsRunning++;
        if (state.lastError) chainsWithErrors++;
        chains.push({
          chainId: chain.chainId,
          name: chain.name,
          status: state.isRunning ? (state.lastError ? "degraded" : "healthy") : "down",
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

  app.get("/api/status/alerts", async (_req, res) => {
    try {
      const alerts = await evaluateAlerts();
      deliverAlerts(alerts).catch(() => {});
      res.json({ alerts });
    } catch (err) {
      res.status(500).json({ error: "Failed to evaluate alerts" });
    }
  });

  app.get("/api/agents/:id/community-feedback", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const id = agent.id;
      const summary = await storage.getCommunityFeedbackSummary(id);
      const sources = await storage.getCommunityFeedbackSources(id);

      let github = null;
      const githubSource = sources.find((s) => s.platform === "github");
      if (githubSource) {
        const items = await storage.getCommunityFeedbackItems(id, "github", undefined, 20);
        github = { source: githubSource, items };
      }

      let farcaster = null;
      const farcasterSource = sources.find((s) => s.platform === "farcaster");
      if (farcasterSource) {
        const items = await storage.getCommunityFeedbackItems(id, "farcaster", undefined, 30);
        farcaster = { source: farcasterSource, items };
      }

      res.json({ summary: summary || null, github, farcaster, twitter: null });
    } catch (err) {
      res.status(500).json({ error: "Failed to get community feedback" });
    }
  });

  app.get("/api/agents/:id/community-feedback/github", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const id = agent.id;
      const sources = await storage.getCommunityFeedbackSources(id, "github");
      if (sources.length === 0) {
        return res.json({ source: null, repoStats: null, issues: [], healthScore: null });
      }
      const source = sources[0];
      const items = await storage.getCommunityFeedbackItems(id, "github", undefined, 20);
      const repoStats = items.find((i) => i.itemType === "repo_stats");
      const issues = items.filter((i) => i.itemType === "issue");
      const summary = await storage.getCommunityFeedbackSummary(id);

      res.json({
        source,
        repoStats: repoStats || null,
        issues,
        healthScore: summary?.githubHealthScore ?? null,
        summary: summary || null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to get GitHub feedback" });
    }
  });

  app.get("/api/agents/:id/community-feedback/farcaster", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const id = agent.id;
      const sources = await storage.getCommunityFeedbackSources(id, "farcaster");
      if (sources.length === 0) {
        return res.json({ source: null, profile: null, casts: [], summary: null });
      }
      const source = sources[0];
      const items = await storage.getCommunityFeedbackItems(id, "farcaster", undefined, 30);
      const profile = items.find((i) => i.itemType === "profile_snapshot");
      const casts = items.filter((i) => i.itemType === "cast");
      const summary = await storage.getCommunityFeedbackSummary(id);

      res.json({
        source,
        profile: profile || null,
        casts,
        summary: summary || null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to get Farcaster feedback" });
    }
  });

  app.get("/api/community-feedback/stats", async (_req, res) => {
    try {
      const stats = await storage.getCommunityFeedbackStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to get community feedback stats" });
    }
  });

  app.get("/api/community-feedback/leaderboard", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const summaries = await storage.getAgentsWithCommunityFeedback(limit, offset);
      res.json({ leaderboard: summaries });
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

  app.get("/api/agents/:id/trust-score", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      if (agent.trustScore === null) {
        const breakdown = await recalculateScore(agent.id);
        if (breakdown) {
          return res.json({ score: breakdown.total, breakdown, updatedAt: new Date().toISOString() });
        }
        return res.json({ score: null, breakdown: null, updatedAt: null });
      }

      res.json({
        score: agent.trustScore,
        breakdown: agent.trustScoreBreakdown,
        updatedAt: agent.trustScoreUpdatedAt,
      });
    } catch (err) {
      logger.error("Error fetching trust score", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust score" });
    }
  });

  app.get("/api/trust-scores/top", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const chainId = parseChainId(req.query.chain);
      const leaderboard = await storage.getTrustScoreLeaderboard(limit, chainId);
      res.json(leaderboard);
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

  app.get("/api/analytics/trust-scores", async (req, res) => {
    try {
      const [distribution, byChain, top] = await Promise.all([
        storage.getTrustScoreDistribution(),
        storage.getTrustScoreStatsByChain(),
        storage.getTrustScoreLeaderboard(20),
      ]);
      res.json({ distribution, byChain, topAgents: top });
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

  app.get("/api/economy/payment-addresses", async (_req, res) => {
    try {
      const addresses = await storage.getAgentsWithPaymentAddresses();
      res.json(addresses);
    } catch (err) {
      logger.error("Error fetching payment addresses", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch payment addresses" });
    }
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

  app.get("/api/economy/transactions/top-earners", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const topEarners = await storage.getTopEarningAgents(limit);
      res.json(topEarners);
    } catch (err) {
      logger.error("Error fetching top earners", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top earners" });
    }
  });

  app.get("/api/agents/:id/transactions", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const transactions = await storage.getTransactions({ agentId: agent.id, limit, offset });
      res.json(transactions);
    } catch (err) {
      logger.error("Error fetching agent transactions", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch agent transactions" });
    }
  });

  app.get("/api/agents/:id/transactions/stats", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const stats = await storage.getAgentTransactionStats(agent.id);
      res.json(stats);
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

  app.get("/api/quality/offenders", async (_req, res) => {
    try {
      const data = await storage.getQualityOffenders();
      res.json(data);
    } catch (err) {
      logger.error("Error fetching quality offenders", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch quality offenders" });
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

}
