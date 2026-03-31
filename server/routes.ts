import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runSync } from "../scripts/sync-prod-to-dev";
import { getAllChains, getEnabledChains, getChain } from "@shared/chains";
import { evaluateAlerts } from "./alerts";
import { getCommunityFeedbackScheduler, discoverAllSources } from "./community-feedback";
import { recalculateScore } from "./trust-score";
import { probeAllAgents } from "./x402-prober";
import { syncAllAgentTransactions } from "./transaction-indexer";

function parseChainId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = parseInt(raw as string, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      console.error("sitemap-agents error:", err);
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

      res.json(result);
    } catch (err) {
      console.error("Error fetching chains:", err);
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

      res.json({ ...result, communityFeedback: feedbackMap });
    } catch (err) {
      console.error("Error fetching agents:", err);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (err) {
      console.error("Error fetching agent:", err);
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
      console.error("Error fetching agent history:", err);
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
      console.error("Error fetching recent events:", err);
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
      console.error("Error fetching agent feedback:", err);
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
      const stats = await storage.getStats(chainId);
      res.json(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/overview", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsOverview();
      res.json(data);
    } catch (err) {
      console.error("Error fetching analytics overview:", err);
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  app.get("/api/analytics/protocol-stats", async (_req, res) => {
    try {
      const data = await storage.getProtocolStats();
      res.json(data);
    } catch (err) {
      console.error("Error fetching protocol stats:", err);
      res.status(500).json({ message: "Failed to fetch protocol stats" });
    }
  });

  app.get("/api/analytics/chain-distribution", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsChainDistribution();
      res.json(data);
    } catch (err) {
      console.error("Error fetching chain distribution:", err);
      res.status(500).json({ message: "Failed to fetch chain distribution" });
    }
  });

  app.get("/api/analytics/registrations", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsRegistrations();
      res.json(data);
    } catch (err) {
      console.error("Error fetching registrations:", err);
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  app.get("/api/analytics/metadata-quality", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsMetadataQuality();
      res.json(data);
    } catch (err) {
      console.error("Error fetching metadata quality:", err);
      res.status(500).json({ message: "Failed to fetch metadata quality" });
    }
  });

  app.get("/api/analytics/x402-by-chain", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsX402ByChain();
      res.json(data);
    } catch (err) {
      console.error("Error fetching x402 by chain:", err);
      res.status(500).json({ message: "Failed to fetch x402 by chain" });
    }
  });

  app.get("/api/analytics/controller-concentration", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsControllerConcentration();
      res.json(data);
    } catch (err) {
      console.error("Error fetching controller concentration:", err);
      res.status(500).json({ message: "Failed to fetch controller concentration" });
    }
  });

  app.get("/api/analytics/uri-schemes", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsUriSchemes();
      res.json(data);
    } catch (err) {
      console.error("Error fetching URI schemes:", err);
      res.status(500).json({ message: "Failed to fetch URI schemes" });
    }
  });

  app.get("/api/analytics/categories", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsCategories();
      res.json(data);
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/analytics/image-domains", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsImageDomains();
      res.json(data);
    } catch (err) {
      console.error("Error fetching image domains:", err);
      res.status(500).json({ message: "Failed to fetch image domains" });
    }
  });

  app.get("/api/analytics/models", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsModels();
      res.json(data);
    } catch (err) {
      console.error("Error fetching models:", err);
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/analytics/endpoints-coverage", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsEndpointsCoverage();
      res.json(data);
    } catch (err) {
      console.error("Error fetching endpoints coverage:", err);
      res.status(500).json({ message: "Failed to fetch endpoints coverage" });
    }
  });

  app.get("/api/analytics/top-agents", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsTopAgents();
      res.json(data);
    } catch (err) {
      console.error("Error fetching top agents:", err);
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  let syncInProgress = false;

  app.post("/api/admin/sync", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(503).json({ message: "Sync not configured (ADMIN_SECRET not set)" });
    }

    const provided = req.headers["x-admin-secret"] || req.body?.secret;
    if (provided !== adminSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
      (msg) => console.log(`[sync] ${msg}`),
    ).then(async (result) => {
      await storage.updateIndexerState(1, { lastSyncedAt: new Date() });
      console.log(`[sync] Complete: ${result.agents} agents, ${result.events} events`);
    }).catch((err) => {
      console.error(`[sync] Failed: ${(err as Error).message}`);
    }).finally(() => {
      syncInProgress = false;
    });
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const enabledChains = getEnabledChains();
      const alerts = await evaluateAlerts();

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

      res.status(200).json({
        status,
        chains,
        activeAlerts,
        criticalAlerts,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(200).json({ status: "unknown", error: "Health check failed" });
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

  app.post("/api/admin/community-feedback/scrape", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(503).json({ message: "Admin not configured" });
    const provided = req.headers["x-admin-secret"] || req.body?.secret;
    if (provided !== adminSecret) return res.status(401).json({ message: "Unauthorized" });

    const scheduler = getCommunityFeedbackScheduler();
    if (!scheduler) return res.status(503).json({ message: "Community feedback not initialized" });
    if (scheduler.isRunning()) return res.status(409).json({ message: "Scrape already in progress" });

    const platform = (req.query.platform as string) || "github";
    res.json({ message: `Scrape started for ${platform}`, status: "running" });

    scheduler.runPlatformScrape(platform).catch((err) => {
      console.error(`[community-feedback] Manual scrape failed: ${(err as Error).message}`);
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
      console.error("Error fetching trust score:", err);
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
      console.error("Error fetching trust score leaderboard:", err);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/trust-scores/distribution", async (req, res) => {
    try {
      const chainId = parseChainId(req.query.chain);
      const distribution = await storage.getTrustScoreDistribution(chainId);
      res.json(distribution);
    } catch (err) {
      console.error("Error fetching trust score distribution:", err);
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
      console.error("Error fetching trust score analytics:", err);
      res.status(500).json({ message: "Failed to fetch trust score analytics" });
    }
  });

  app.get("/api/economy/overview", async (_req, res) => {
    try {
      const overview = await storage.getEconomyOverview();
      res.json(overview);
    } catch (err) {
      console.error("Error fetching economy overview:", err);
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
      console.error("Error fetching top x402 agents:", err);
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  app.get("/api/economy/endpoints", async (_req, res) => {
    try {
      const analysis = await storage.getEndpointAnalysis();
      res.json(analysis);
    } catch (err) {
      console.error("Error fetching endpoint analysis:", err);
      res.status(500).json({ message: "Failed to fetch endpoint analysis" });
    }
  });

  app.get("/api/economy/chain-breakdown", async (_req, res) => {
    try {
      const breakdown = await storage.getX402AdoptionByChain();
      res.json(breakdown);
    } catch (err) {
      console.error("Error fetching chain breakdown:", err);
      res.status(500).json({ message: "Failed to fetch chain breakdown" });
    }
  });

  app.get("/api/economy/probes", async (_req, res) => {
    try {
      const stats = await storage.getProbeStats();
      res.json(stats);
    } catch (err) {
      console.error("Error fetching probe stats:", err);
      res.status(500).json({ message: "Failed to fetch probe stats" });
    }
  });

  app.get("/api/economy/payment-addresses", async (_req, res) => {
    try {
      const addresses = await storage.getAgentsWithPaymentAddresses();
      res.json(addresses);
    } catch (err) {
      console.error("Error fetching payment addresses:", err);
      res.status(500).json({ message: "Failed to fetch payment addresses" });
    }
  });

  app.get("/api/economy/transactions/stats", async (_req, res) => {
    try {
      const stats = await storage.getTransactionStats();
      res.json(stats);
    } catch (err) {
      console.error("Error fetching transaction stats:", err);
      res.status(500).json({ message: "Failed to fetch transaction stats" });
    }
  });

  app.get("/api/economy/transactions/recent", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const transactions = await storage.getTransactions({ limit });
      res.json(transactions);
    } catch (err) {
      console.error("Error fetching recent transactions:", err);
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  app.get("/api/economy/transactions/volume", async (req, res) => {
    try {
      const period = (req.query.period as string) || "30d";
      const volume = await storage.getTransactionVolume(period);
      res.json(volume);
    } catch (err) {
      console.error("Error fetching transaction volume:", err);
      res.status(500).json({ message: "Failed to fetch transaction volume" });
    }
  });

  app.get("/api/economy/transactions/top-earners", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const topEarners = await storage.getTopEarningAgents(limit);
      res.json(topEarners);
    } catch (err) {
      console.error("Error fetching top earners:", err);
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
      console.error("Error fetching agent transactions:", err);
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
      console.error("Error fetching agent transaction stats:", err);
      res.status(500).json({ message: "Failed to fetch agent transaction stats" });
    }
  });

  app.post("/api/admin/transactions/sync", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(503).json({ message: "Admin not configured" });
    const provided = req.headers["x-admin-secret"] || req.body?.secret;
    if (provided !== adminSecret) return res.status(401).json({ message: "Unauthorized" });

    try {
      res.json({ message: "Transaction sync started", status: "running" });
      syncAllAgentTransactions().catch((err) => {
        console.error("Manual transaction sync failed:", err);
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to start transaction sync" });
    }
  });

  app.post("/api/admin/probes/run", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(503).json({ message: "Admin not configured" });
    const provided = req.headers["x-admin-secret"] || req.body?.secret;
    if (provided !== adminSecret) return res.status(401).json({ message: "Unauthorized" });

    try {
      res.json({ message: "Probe run started", status: "running" });
      probeAllAgents().catch((err) => {
        console.error("Manual probe run failed:", err);
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
      console.error("Error fetching quality summary:", err);
      res.status(500).json({ message: "Failed to fetch quality summary" });
    }
  });

  app.get("/api/quality/offenders", async (_req, res) => {
    try {
      const data = await storage.getQualityOffenders();
      res.json(data);
    } catch (err) {
      console.error("Error fetching quality offenders:", err);
      res.status(500).json({ message: "Failed to fetch quality offenders" });
    }
  });

  app.post("/api/admin/community-feedback/discover", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(503).json({ message: "Admin not configured" });
    const provided = req.headers["x-admin-secret"] || req.body?.secret;
    if (provided !== adminSecret) return res.status(401).json({ message: "Unauthorized" });

    try {
      const result = await discoverAllSources();
      res.json({ message: "Discovery complete", ...result });
    } catch (err) {
      res.status(500).json({ error: "Discovery failed" });
    }
  });

  app.get("/api/skills/summary", async (_req, res) => {
    try {
      const data = await storage.getSkillsSummary();
      res.json(data);
    } catch (err) {
      console.error("Error fetching skills summary:", err);
      res.status(500).json({ message: "Failed to fetch skills summary" });
    }
  });

  app.get("/api/skills/chain-distribution", async (_req, res) => {
    try {
      const data = await storage.getSkillsChainDistribution();
      res.json(data);
    } catch (err) {
      console.error("Error fetching skills chain distribution:", err);
      res.status(500).json({ message: "Failed to fetch skills chain distribution" });
    }
  });

  app.get("/api/skills/top-capabilities", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
      const data = await storage.getSkillsTopCapabilities(limit);
      res.json(data);
    } catch (err) {
      console.error("Error fetching top capabilities:", err);
      res.status(500).json({ message: "Failed to fetch top capabilities" });
    }
  });

  app.get("/api/skills/category-breakdown", async (_req, res) => {
    try {
      const data = await storage.getSkillsCategoryBreakdown();
      res.json(data);
    } catch (err) {
      console.error("Error fetching category breakdown:", err);
      res.status(500).json({ message: "Failed to fetch category breakdown" });
    }
  });

  app.get("/api/skills/trust-correlation", async (_req, res) => {
    try {
      const data = await storage.getSkillsTrustCorrelation();
      res.json(data);
    } catch (err) {
      console.error("Error fetching trust correlation:", err);
      res.status(500).json({ message: "Failed to fetch trust correlation" });
    }
  });

  app.get("/api/skills/oasf-overview", async (_req, res) => {
    try {
      const data = await storage.getSkillsOasfOverview();
      res.json(data);
    } catch (err) {
      console.error("Error fetching OASF overview:", err);
      res.status(500).json({ message: "Failed to fetch OASF overview" });
    }
  });

  app.get("/api/skills/notable-agents", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const data = await storage.getSkillsNotableAgents(limit);
      res.json(data);
    } catch (err) {
      console.error("Error fetching notable agents:", err);
      res.status(500).json({ message: "Failed to fetch notable agents" });
    }
  });

  return httpServer;
}
