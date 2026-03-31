import { schedules, logger } from "@trigger.dev/sdk/v3";
import { syncAllAgentTransactions } from "../server/transaction-indexer";

export const transactionIndexerTask = schedules.task({
  id: "transaction-indexer",
  // Run every 6 hours
  cron: "0 */6 * * *",
  run: async (payload) => {
    logger.info("Starting transaction indexer sync", {
      timestamp: payload.timestamp,
    });

    const result = await syncAllAgentTransactions();
    logger.info("Transaction sync complete", { result });

    return result;
  },
});
