import { schedules, logger } from "@trigger.dev/sdk/v3";
import { startIndexer, stopIndexer } from "../server/indexer";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  // Run every 2 minutes — each cycle polls all enabled chains
  cron: "*/2 * * * *",
  run: async (payload) => {
    logger.info("Starting blockchain indexer cycle", {
      timestamp: payload.timestamp,
    });

    const indexers = startIndexer();
    logger.info(`Started ${indexers.length} chain indexer(s)`);

    // Let indexers run for 90 seconds (one full cycle), then stop
    await new Promise((resolve) => setTimeout(resolve, 90_000));

    stopIndexer();
    logger.info("Blockchain indexer cycle complete");

    return { chainsIndexed: indexers.length };
  },
});
