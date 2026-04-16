import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const mppProberTask = schedules.task({
  id: "mpp-prober",
  cron: "30 3 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("MPP prober disabled (ENABLE_MPP_INDEXER!=true)");
      return { skipped: true };
    }

    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      metadata.set("phase", "probing");
      const { probeAllAgentsForMpp } = await import("../server/mpp-prober");
      const result = await probeAllAgentsForMpp({ deadlineMs: Date.now() + 540_000 });

      metadata.set("totalAgents", result.total);
      metadata.set("probed", result.probed);
      metadata.set("foundMpp", result.foundMpp);
      metadata.set("tempoAddresses", result.tempoAddresses);
      metadata.set("errors", result.errors);
      metadata.set("skippedDueToTimeout", result.skippedDueToTimeout);
      logger.info("MPP probe cycle complete", { result });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("computeCostCents", cost.totalCostInCents);

      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("mpp-prober", "MPP Endpoint Prober");
      } catch {}
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("mpp-prober failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("mpp-prober", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("mpp-prober", "MPP Endpoint Prober", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
