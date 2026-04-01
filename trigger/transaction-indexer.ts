import { schedules, logger } from "@trigger.dev/sdk/v3";
import { syncAllAgentTransactions } from "../server/transaction-indexer";
import { notifyJobFailure } from "./alert";

export const transactionIndexerTask = schedules.task({
  id: "transaction-indexer",
  // Run every 6 hours
  cron: "0 */6 * * *",
  run: async (payload) => {
    try {
      logger.info("Starting transaction indexer sync", {
        timestamp: payload.timestamp,
      });

      const result = await syncAllAgentTransactions();
      logger.info("Transaction sync complete", { result });

      return result;
    } catch (err) {
      await notifyJobFailure("transaction-indexer", err as Error);
      throw err;
    }
  },
});
