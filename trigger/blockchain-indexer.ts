import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 120,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { startIndexerImmediate, stopIndexer } = await import("../server/indexer");

      metadata.set("phase", "starting-indexers");
      const result = await startIndexerImmediate();
      metadata.set("chainsStarted", result.started);
      metadata.set("chainsFailed", result.failed);
      logger.info(`Started ${result.started} chain indexer(s)`, { failed: result.failed });

      if (result.started === 0) {
        logger.error("No chains started successfully");
        metadata.set("status", "failed");
        metadata.set("lastError", `All chains failed: ${result.failed.join("; ")}`);
        return { error: "No chains started", failed: result.failed };
      }

      metadata.set("phase", "indexing");
      await new Promise((resolve) => setTimeout(resolve, 90_000));

      metadata.set("phase", "stopping");
      stopIndexer();
      logger.info("Blockchain indexer cycle complete");

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { chainsIndexed: result.started, failed: result.failed };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("blockchain-indexer failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message };
    }
  },
});
