import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const tempoTransactionIndexerTask = schedules.task({
  id: "tempo-transaction-indexer",
  cron: "0 */6 * * *",
  maxDuration: 600,
  run: async (_payload) => {
    if (process.env.ENABLE_MPP_INDEXER !== "true") {
      logger.info("Tempo indexer disabled");
      return { skipped: true };
    }

    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { syncAllTempoTransactions } = await import("../server/tempo-transaction-indexer");
      const result = await syncAllTempoTransactions();
      metadata.set("addresses", result.addresses);
      metadata.set("transfers", result.transfers);
      metadata.set("errors", result.errors);
      logger.info("Tempo indexer complete", { result });

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("computeCostCents", cost.totalCostInCents);

      try {
        const { recordSuccess } = await import("../server/pipeline-health");
        await recordSuccess("tempo-transaction-indexer", "Tempo Transaction Indexer");
      } catch {}
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("tempo-transaction-indexer failed", { error: error.message });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      try {
        const { notifyJobFailure } = await import("./alert");
        await notifyJobFailure("tempo-transaction-indexer", error);
      } catch {}
      try {
        const { recordFailure } = await import("../server/pipeline-health");
        await recordFailure("tempo-transaction-indexer", "Tempo Transaction Indexer", error.message);
      } catch {}
      return { error: error.message };
    }
  },
});
