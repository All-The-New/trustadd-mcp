import type { Express } from "express";
import { createLogger } from "../lib/logger.js";
import { createTrustProductGate } from "../lib/x402-gate.js";
import {
  resolveAgentByAddress,
  getOrCompileReport,
  incrementAccessCount,
  computeVerdict,
  type QuickCheckData,
  type FullReportData,
  type Verdict,
} from "../trust-report-compiler.js";
import { getMethodology } from "../trust-methodology.js";
import { getAllPipelineHealth } from "../pipeline-health.js";
import { parseChainId } from "./helpers.js";

const logger = createLogger("routes:trust");

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const trustProductEnabled = process.env.TRUST_PRODUCT_ENABLED?.toLowerCase() === "true";

export function registerTrustRoutes(app: Express): void {
  // Free endpoint — methodology description for the trust scoring rubric
  app.get("/api/v1/trust/methodology", (_req, res) => {
    res.json(getMethodology());
  });

  // Free endpoint — pipeline health for circuit breaker status
  app.get("/api/v1/trust/pipeline-health", async (_req, res) => {
    try {
      const health = await getAllPipelineHealth();
      const hasOpen = health.some(h => h.circuitState === "open");
      res.json({
        status: hasOpen ? "degraded" : "healthy",
        pipelines: health.map(h => ({
          taskId: h.taskId,
          name: h.taskName,
          lastSuccessAt: h.lastSuccessAt?.toISOString() ?? null,
          consecutiveFailures: h.consecutiveFailures,
          circuitState: h.circuitState,
        })),
      });
    } catch (err) {
      res.json({ status: "unknown", pipelines: [] });
    }
  });

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

      // Use the same verdict logic as the paid endpoints (null score → UNKNOWN)
      const verdict: Verdict = agent.trustScore == null
        ? "UNKNOWN"
        : computeVerdict(
            agent.trustScore,
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
}
