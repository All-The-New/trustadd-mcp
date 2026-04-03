import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 120,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      // Diagnostic: check env vars and chain connectivity
      const alchemyKey = process.env.API_KEY_ALCHEMY;
      const infuraKey = process.env.API_KEY_INFURA;
      metadata.set("hasAlchemy", !!alchemyKey);
      metadata.set("hasInfura", !!infuraKey);
      metadata.set("alchemyKeyPrefix", alchemyKey?.slice(0, 6) || "unset");

      const { getEnabledChains } = await import("../shared/chains");
      const enabledChains = getEnabledChains();
      metadata.set("enabledChains", enabledChains.map((c) => c.name));
      logger.info(`Enabled chains: ${enabledChains.map((c) => c.name).join(", ")}`);

      if (enabledChains.length === 0) {
        logger.error("No chains enabled — RPC keys missing");
        metadata.set("status", "failed");
        metadata.set("lastError", "No chains enabled");
        return { error: "No chains enabled", hasAlchemy: !!alchemyKey, hasInfura: !!infuraKey };
      }

      const { startIndexer, stopIndexer } = await import("../server/indexer");

      metadata.set("phase", "starting-indexers");
      const indexers = startIndexer();
      metadata.set("chainsStarted", indexers.length);
      logger.info(`Started ${indexers.length} chain indexer(s)`);

      // Check DB state before indexing
      const { storage } = await import("../server/storage");
      const stateBefore = await storage.getIndexerState(enabledChains[0].chainId);
      metadata.set("chain0BlockBefore", stateBefore.lastProcessedBlock);
      metadata.set("chain0RunningBefore", stateBefore.isRunning);
      logger.info(`Chain ${enabledChains[0].name} state before: block=${stateBefore.lastProcessedBlock}, running=${stateBefore.isRunning}`);

      metadata.set("phase", "indexing");
      await new Promise((resolve) => setTimeout(resolve, 90_000));

      // Check DB state after indexing
      const stateAfter = await storage.getIndexerState(enabledChains[0].chainId);
      metadata.set("chain0BlockAfter", stateAfter.lastProcessedBlock);
      metadata.set("chain0RunningAfter", stateAfter.isRunning);
      logger.info(`Chain ${enabledChains[0].name} state after: block=${stateAfter.lastProcessedBlock}, running=${stateAfter.isRunning}`);

      metadata.set("phase", "stopping");
      stopIndexer();
      logger.info("Blockchain indexer cycle complete");

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return {
        chainsIndexed: indexers.length,
        chain0BlockBefore: stateBefore.lastProcessedBlock,
        chain0BlockAfter: stateAfter.lastProcessedBlock,
        progressed: stateAfter.lastProcessedBlock > stateBefore.lastProcessedBlock,
      };
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
