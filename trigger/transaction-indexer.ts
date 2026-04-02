import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";

export const transactionIndexerTask = schedules.task({
  id: "transaction-indexer",
  cron: "0 */6 * * *",
  maxDuration: 300,
  run: async (payload) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    try {
      metadata.set("phase", "syncing");
      const { syncAllAgentTransactions } = await import("../server/transaction-indexer");
      const result = await syncAllAgentTransactions();

      metadata.set("addressesSynced", result.addressesSynced);
      metadata.set("totalTxns", result.totalTxns);
      metadata.set("totalIncoming", result.totalIncoming);
      metadata.set("totalOutgoing", result.totalOutgoing);
      metadata.set("errors", result.errors);
      logger.info("Transaction sync complete", { result });

      const cost = await usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("computeCostCents", cost.costInCents);
      metadata.set("durationMs", cost.durationMs);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("transaction-indexer failed", { error: error.message, stack: error.stack });
      metadata.set("status", "failed");
      metadata.set("lastError", error.message);
      metadata.set("lastErrorAt", new Date().toISOString());
      return { error: error.message };
    }
  },
});
