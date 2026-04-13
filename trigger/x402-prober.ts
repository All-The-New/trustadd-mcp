import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const x402ProberTask = schedules.task({
  id: "x402-prober",
  cron: "0 3 * * *",
  maxDuration: 600,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      metadata.set("phase", "probing");
      const { probeAllAgents } = await import("../server/x402-prober");
      // 540s budget = 600s maxDuration minus 60s buffer for cleanup
      const result = await probeAllAgents({ deadlineMs: Date.now() + 540_000 });

      metadata.set("totalAgents", result.total);
      metadata.set("probed", result.probed);
      metadata.set("found402", result.found402);
      metadata.set("paymentAddresses", result.paymentAddresses);
      metadata.set("errors", result.errors);
      metadata.set("skippedDueToTimeout", result.skippedDueToTimeout);
      logger.info("x402 probing complete", { result });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.totalCostInCents);
      metadata.set("durationMs", cost.compute.total.durationMs);

      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("x402-prober", "x402 Endpoint Prober");
      } catch {}

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("x402-prober failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("x402-prober", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("x402-prober", "x402 Endpoint Prober", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
