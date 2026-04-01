import { schedules, logger } from "@trigger.dev/sdk/v3";

export const transactionIndexerTask = schedules.task({
  id: "transaction-indexer",
  // Run every 6 hours
  cron: "0 */6 * * *",
  run: async (payload) => {
    logger.info("Starting transaction indexer sync", { timestamp: payload.timestamp });

    try {
      const { syncAllAgentTransactions } = await import("../server/transaction-indexer");
      const result = await syncAllAgentTransactions();
      logger.info("Transaction sync complete", { result });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("transaction-indexer failed", { error: error.message, stack: error.stack });
      return { error: error.message };
    }
  },
});
