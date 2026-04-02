import { schedules, task, logger, metadata, usage } from "@trigger.dev/sdk/v3";

/**
 * Per-chain indexer sub-task. Runs a single chain's indexer for 90 seconds.
 * Triggered by the parent blockchain-indexer scheduled task.
 */
export const chainIndexerTask = task({
  id: "chain-indexer",
  queue: { name: "chain-indexing", concurrencyLimit: 3 },
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: { chainId: number; chainName: string }) => {
    metadata.set("status", "running");
    metadata.set("chainId", payload.chainId);
    metadata.set("chainName", payload.chainName);

    try {
      const { ERC8004Indexer } = await import("../server/indexer");
      const { getEnabledChains } = await import("../shared/chains");

      const chain = getEnabledChains().find((c) => c.chainId === payload.chainId);
      if (!chain) {
        logger.warn(`Chain ${payload.chainId} not enabled, skipping`);
        metadata.set("status", "skipped");
        return { skipped: true, reason: "chain not enabled" };
      }

      metadata.set("phase", "starting");
      const indexer = new ERC8004Indexer(chain);
      await indexer.start();
      logger.info(`Indexer started for ${payload.chainName}`);

      metadata.set("phase", "indexing");
      await new Promise((resolve) => setTimeout(resolve, 90_000));

      metadata.set("phase", "stopping");
      await indexer.stop();
      logger.info(`Indexer cycle complete for ${payload.chainName}`);

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return { chainId: payload.chainId, chainName: payload.chainName, success: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Chain ${payload.chainName} indexer failed`, {
        error: error.message,
        stack: error.stack,
      });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { chainId: payload.chainId, error: error.message };
    }
  },
});

/**
 * Parent scheduled task. Triggers one sub-task per enabled chain.
 * Each chain runs independently with its own retry policy.
 */
export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 30,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { getEnabledChains } = await import("../shared/chains");
      const chains = getEnabledChains();
      metadata.set("chainsEnabled", chains.length);

      // Prune old events/metrics (fire-and-forget)
      try {
        const { storage } = await import("../server/storage");
        storage.pruneOldEvents(7).catch(() => {});
        storage.pruneOldMetrics(30).catch(() => {});
      } catch { /* non-critical */ }

      // Trigger per-chain sub-tasks with idempotency keys
      const dateKey = new Date().toISOString().slice(0, 16); // "2026-04-01T23:30"
      const triggered: string[] = [];

      for (const chain of chains) {
        const handle = await chainIndexerTask.trigger(
          { chainId: chain.chainId, chainName: chain.name },
          {
            idempotencyKey: `chain-${chain.chainId}-${dateKey}`,
            idempotencyKeyTTL: "3m",
            tags: [`chain:${chain.chainId}`, `chain:${chain.shortName}`],
          },
        );
        triggered.push(`${chain.name}:${handle.id}`);
      }

      logger.info(`Triggered ${triggered.length} chain indexers`, { triggered });

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("chainsTriggered", triggered.length);
      metadata.set("computeCostCents", cost.costInCents);

      return { chainsTriggered: triggered.length, runs: triggered };
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
