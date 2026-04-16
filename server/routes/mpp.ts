import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { storage } from "../storage.js";
import { cached, ANALYTICS_CACHE, ANALYTICS_TTL, redactAgentForPublic } from "./helpers.js";

const logger = createLogger("routes:mpp");

// Feature flag: skip entirely if MPP UI is not enabled
const ENABLE_MPP = process.env.ENABLE_MPP_UI === "true";

/** Parse a positive integer from a query param with fallback. Clamps to [min, max]. */
function parsePositiveInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

export function registerMppRoutes(app: Express): void {
  if (!ENABLE_MPP) {
    logger.info("MPP routes not registered (ENABLE_MPP_UI!=true)");
    return;
  }

  // --- Directory ---

  app.get("/api/mpp/directory/stats", async (_req, res) => {
    try {
      const data = await cached("mpp:directory:stats", ANALYTICS_TTL, () => storage.getMppDirectoryStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp directory stats failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP directory stats" });
    }
  });

  app.get("/api/mpp/directory/services", async (req, res) => {
    try {
      const page = parsePositiveInt(req.query.page, 1, 1, 100_000);
      const limit = parsePositiveInt(req.query.limit, 50, 1, 200);
      const offset = (page - 1) * limit;

      const result = await storage.listMppServices({
        limit,
        offset,
        category: req.query.category as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.set("Cache-Control", "public, s-maxage=60");
      res.json({ ...result, page, limit });
    } catch (err) {
      logger.error("mpp services list failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to list MPP services" });
    }
  });

  app.get("/api/mpp/directory/trends", async (req, res) => {
    try {
      const days = parsePositiveInt(req.query.days, 30, 1, 180);
      const data = await cached(`mpp:directory:trends:${days}`, 60 * 60 * 1000, () => storage.getMppDirectoryTrends(days));
      res.set("Cache-Control", "public, s-maxage=3600");
      res.json(data);
    } catch (err) {
      logger.error("mpp trends failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP trends" });
    }
  });

  app.get("/api/mpp/directory/top-providers", async (_req, res) => {
    try {
      const data = await cached("mpp:directory:top-providers", ANALYTICS_TTL, async () => {
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          SELECT provider_name, COUNT(*)::int AS service_count
          FROM mpp_directory_services
          WHERE is_active = true AND provider_name IS NOT NULL
          GROUP BY provider_name
          ORDER BY service_count DESC
          LIMIT 20
        `);
        return result.rows;
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp top providers failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch top providers" });
    }
  });

  // --- Adoption ---

  app.get("/api/mpp/adoption", async (_req, res) => {
    try {
      const data = await cached("mpp:adoption", ANALYTICS_TTL, () => storage.getMppAdoptionStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp adoption failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch MPP adoption stats" });
    }
  });

  app.get("/api/mpp/probes/recent", async (req, res) => {
    try {
      const limit = parsePositiveInt(req.query.limit, 20, 1, 100);
      const { db } = await import("../db.js");
      const { mppProbes } = await import("../../shared/schema.js");
      const { desc, eq } = await import("drizzle-orm");
      const rows = await db.select().from(mppProbes)
        .where(eq(mppProbes.hasMpp, true))
        .orderBy(desc(mppProbes.probedAt))
        .limit(limit);
      res.set("Cache-Control", "public, s-maxage=60");
      res.json(rows);
    } catch (err) {
      logger.error("mpp recent probes failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch recent probes" });
    }
  });

  // --- Chain analytics ---

  app.get("/api/mpp/chain/stats", async (_req, res) => {
    try {
      const data = await cached("mpp:chain:stats", ANALYTICS_TTL, () => storage.getMppTempoChainStats());
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("mpp chain stats failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch Tempo chain stats" });
    }
  });

  app.get("/api/mpp/chain/volume-trend", async (req, res) => {
    try {
      const days = parsePositiveInt(req.query.days, 30, 1, 180);
      const data = await cached(`mpp:chain:volume-trend:${days}`, 60 * 60 * 1000, async () => {
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          SELECT date_trunc('day', block_timestamp)::date AS day,
                 SUM(amount_usd)::float AS volume,
                 COUNT(*)::int AS tx_count
          FROM agent_transactions
          WHERE chain_id = 4217 AND category = 'mpp_payment'
            AND block_timestamp >= now() - (${days} * interval '1 day')
          GROUP BY day ORDER BY day
        `);
        return result.rows;
      });
      res.set("Cache-Control", "public, s-maxage=3600");
      res.json(data);
    } catch (err) {
      logger.error("mpp volume-trend failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch volume trend" });
    }
  });

  // --- Cross-protocol ---

  app.get("/api/ecosystem/protocol-comparison", async (_req, res) => {
    try {
      const data = await cached("ecosystem:protocol-comparison", ANALYTICS_TTL, async () => {
        const mpp = await storage.getMppTempoChainStats();
        const mppDir = await storage.getMppDirectoryStats();
        // x402 bazaar stats
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");
        const bazaarRes = await db.execute(sql`
          SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active
          FROM bazaar_services
        `);
        const bazaar = bazaarRes.rows[0] as any;

        const adoption = await storage.getMppAdoptionStats();

        return {
          x402: {
            directoryServices: Number(bazaar.total),
            activeServices: Number(bazaar.active),
          },
          mpp: {
            directoryServices: mppDir.totalServices,
            activeServices: mppDir.activeServices,
            volume: mpp.volume,
            txCount: mpp.txCount,
          },
          adoption,
        };
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("protocol comparison failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch protocol comparison" });
    }
  });

  app.get("/api/ecosystem/multi-protocol-agents", async (_req, res) => {
    try {
      const data = await cached("ecosystem:multi-protocol-agents", ANALYTICS_TTL, async () => {
        const ids = await storage.getMultiProtocolAgentIds();
        const limited = ids.slice(0, 100);
        if (limited.length === 0) return { total: 0, agents: [] };

        // Batch fetch to avoid N+1 DB round-trips.
        const { db } = await import("../db.js");
        const { agents } = await import("../../shared/schema.js");
        const { inArray } = await import("drizzle-orm");
        const rows = await db.select().from(agents).where(inArray(agents.id, limited));
        const agentList = rows.map((a) => redactAgentForPublic(a as unknown as Record<string, unknown>));
        return { total: ids.length, agents: agentList };
      });
      res.set("Cache-Control", ANALYTICS_CACHE);
      res.json(data);
    } catch (err) {
      logger.error("multi-protocol agents failed", { error: (err as Error).message });
      res.status(500).json({ message: "Failed to fetch multi-protocol agents" });
    }
  });
}
