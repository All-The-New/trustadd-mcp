import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 120,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      // Step 1: Check chains
      logger.info("Step 1: importing chains...");
      const { getEnabledChains } = await import("../shared/chains");
      const chains = getEnabledChains();
      metadata.set("enabledChains", chains.length);
      logger.info(`Step 1 OK: ${chains.length} chains enabled`);

      // Step 2: Start indexer
      logger.info("Step 2: importing indexer...");
      const { startIndexer, stopIndexer } = await import("../server/indexer");
      logger.info("Step 2a: calling startIndexer...");
      const indexers = startIndexer();
      metadata.set("chainsStarted", indexers.length);
      logger.info(`Step 2 OK: ${indexers.length} indexers started`);

      // Step 3: Wait 90s
      metadata.set("phase", "indexing");
      logger.info("Step 3: waiting 90s...");
      await new Promise((resolve) => setTimeout(resolve, 90_000));
      logger.info("Step 3 OK: 90s elapsed");

      // Step 4: Stop
      metadata.set("phase", "stopping");
      stopIndexer();
      logger.info("Step 4 OK: stopped");

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { chainsIndexed: indexers.length };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("blockchain-indexer CAUGHT ERROR", {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorStack", error.stack?.split("\n").slice(0, 5).join(" | "));
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message, stack: error.stack?.split("\n").slice(0, 5) };
    }
  },
});
