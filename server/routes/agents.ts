import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { storage } from "../storage.js";
import { verdictFor, redactAgentForPublic, cached, parseChainId } from "./helpers.js";
import { deriveCategoryStrengths } from "../trust-categories.js";

const logger = createLogger("routes:agents");

export function registerAgentRoutes(app: Express): void {
  app.get("/api/agents", async (req, res) => {
    try {
      // Rate limit: 10 req/min enforced by DB-backed limiter in api/[...path].ts
      const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 20) : undefined;
      const offset = req.query.offset ? Math.max(parseInt(req.query.offset as string, 10) || 0, 0) : undefined;
      const search = req.query.search as string | undefined;
      const filter = req.query.filter as "all" | "claimed" | "unclaimed" | "has-metadata" | "x402-enabled" | "has-reputation" | "has-feedback" | undefined;
      const chainId = parseChainId(req.query.chainId);
      const sort = req.query.sort as "newest" | "oldest" | "trust-score" | "name" | undefined;
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
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "GitHub signals are available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
      });
    } catch (err) {
      logger.error("Error in github feedback gate", { error: (err as Error).message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/agents/:id/community-feedback/farcaster", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.set("X-TrustAdd-Tier", "gated");
      res.status(402).json({
        message: "Farcaster signals are available in the Full Trust Report ($0.05 USDC via x402).",
        endpoint: `/api/v1/trust/${agent.primaryContractAddress}/report`,
        fullReportPrice: "$0.05",
        paymentNetwork: "eip155:8453",
      });
    } catch (err) {
      logger.error("Error in farcaster feedback gate", { error: (err as Error).message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Free tier: verdict only. Full score/breakdown available via x402 trust report.
  app.get("/api/agents/:id/trust-score", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const verdict = verdictFor(agent.trustScore ?? null, agent.qualityTier ?? null, agent.spamFlags ?? null, agent.lifecycleStatus ?? null);
      const categoryStrengths = agent.trustScoreBreakdown
        ? deriveCategoryStrengths(agent.trustScoreBreakdown as any, agent.sybilRiskScore ?? 0)
        : null;

      res.set("X-TrustAdd-Tier", "free");
      res.json({
        verdict,
        updatedAt: agent.trustScoreUpdatedAt ?? null,
        reportAvailable: true,
        categoryStrengths,
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
      const redacted = (leaderboard as any[]).map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        chainId: entry.chainId,
        imageUrl: entry.imageUrl,
        primaryContractAddress: entry.primaryContractAddress,
        erc8004Id: entry.erc8004Id,
        description: entry.description,
        x402Support: entry.x402Support,
        endpoints: entry.endpoints,
        verdict: verdictFor(entry.trustScore ?? null, entry.qualityTier ?? null, entry.spamFlags ?? null, entry.lifecycleStatus ?? null),
      }));
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
}
