import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { storage } from "../storage.js";
import { pool } from "../db.js";
import { cached, parseChainId, ANALYTICS_CACHE, ANALYTICS_TTL } from "./helpers.js";

const logger = createLogger("routes:analytics");

export function registerAnalyticsRoutes(app: Express): void {
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

  app.get("/api/economy/overview", async (_req, res) => {
    try {
      const overview = await storage.getEconomyOverview();
      res.json(overview);
    } catch (err) {
      logger.error("Error fetching economy overview", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch economy overview" });
    }
  });

  // Free tier: strip trust scores from x402 top agents
  app.get("/api/economy/top-agents", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
      const chainId = parseChainId(req.query.chain);
      const topAgents = await storage.getTopX402Agents(limit, chainId);
      const redacted = (topAgents as any[]).map(({ trustScore: _ts, trustScoreBreakdown: _tsb, ...safe }: any) => safe);
      res.set("X-TrustAdd-Tier", "free");
      res.json(redacted);
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

  // Free tier: strip avgTrustScore from chain breakdown
  app.get("/api/economy/chain-breakdown", async (_req, res) => {
    try {
      const breakdown = await storage.getX402AdoptionByChain();
      const redacted = (breakdown as any[]).map(({ avgTrustScore: _ats, ...safe }: any) => safe);
      res.set("X-TrustAdd-Tier", "free");
      res.json(redacted);
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

  // Free tier: strip trust scores from notable agents
  app.get("/api/skills/notable-agents", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const data = await storage.getSkillsNotableAgents(limit);
      const redacted = (data as any[]).map(({ trustScore: _ts, ...safe }: any) => safe);
      res.set("X-TrustAdd-Tier", "free");
      res.json(redacted);
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
        const { db } = await import("../db.js");
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
        const { db } = await import("../db.js");
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

  app.get("/api/analytics/trust-tiers", async (_req, res) => {
    try {
      const { tiers, buckets } = await cached("analytics:trust-tiers", ANALYTICS_TTL, () => storage.getTrustTierDistribution());
      const total = tiers.reduce((a, t) => a + t.count, 0);
      const pct = (tier: string) => tiers.find(t => t.tier === tier)?.pct ?? 0;
      const narrative =
        `The agent economy is early: of ~${total.toLocaleString()} registered agents, ` +
        `${pct("INSUFFICIENT").toFixed(0)}% are INSUFFICIENT, ` +
        `${pct("FLAGGED").toFixed(0)}% are FLAGGED, ` +
        `${pct("BUILDING").toFixed(0)}% are BUILDING, and fewer than ` +
        `${Math.max(pct("TRUSTED"), 0.05).toFixed(2)}% have reached TRUSTED. ` +
        `${tiers.find(t => t.tier === "VERIFIED")?.count === 0 ? "Zero" : "Few"} agents are VERIFIED.`;
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json({ tiers, buckets, narrative });
    } catch (err) {
      logger.error("trust-tiers failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch trust tier distribution" });
    }
  });
}
