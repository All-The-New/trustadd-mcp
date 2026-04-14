import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { storage } from "../storage.js";
import { getAllChains, getEnabledChains } from "../../shared/chains.js";
import { evaluateAlerts, deliverAlerts } from "../alerts.js";
import { parseChainId } from "./helpers.js";

const logger = createLogger("routes:status");

export function registerStatusRoutes(app: Express): void {
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

  // NOT READY — returns empty until real oracle addresses are configured in known-reputation-sources.ts
  app.get("/api/reputation-sources", (_req, res) => {
    res.json({});
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
}
