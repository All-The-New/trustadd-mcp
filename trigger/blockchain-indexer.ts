import { schedules, logger, metadata, usage } from "@trigger.dev/sdk/v3";
import { chainIndexerTask } from "./chain-indexer.js";

export const blockchainIndexerTask = schedules.task({
  id: "blockchain-indexer",
  cron: "*/2 * * * *",
  maxDuration: 300,
  run: async (payload) => {
    metadata.set("status", "dispatching");
    metadata.set("startedAt", new Date().toISOString());

    try {
      const { getEnabledChains } = await import("../shared/chains.js");

      const chains = getEnabledChains();
      if (chains.length === 0) {
        metadata.set("status", "failed");
        metadata.set("lastError", "No chains enabled");
        return { error: "No chains enabled" };
      }

      metadata.set("chainCount", chains.length);
      metadata.set("chains", chains.map((c) => c.shortName).join(", "));
      logger.info(`Dispatching ${chains.length} chain indexer tasks`);

      // batchTriggerAndWait — parent checkpoints while waiting (free compute)
      const results = await chainIndexerTask.batchTriggerAndWait(
        chains.map((chain) => ({
          payload: { chainId: chain.chainId, chainName: chain.name },
          options: {
            queue: `chain-indexer-${chain.chainId}`,
            concurrencyKey: String(chain.chainId),
          },
        })),
      );

      let succeeded = 0;
      let failed = 0;
      const failures: string[] = [];
      let totalBlocks = 0;
      let totalAgents = 0;

      for (const run of results.runs) {
        if (run.ok) {
          succeeded++;
          const output = run.output as {
            totalBlocksIndexed?: number;
            totalAgentsDiscovered?: number;
            blocksIndexed?: number;
            agentsDiscovered?: number;
          } | null;
          totalBlocks += output?.totalBlocksIndexed ?? output?.blocksIndexed ?? 0;
          totalAgents += output?.totalAgentsDiscovered ?? output?.agentsDiscovered ?? 0;
        } else {
          failed++;
          failures.push(String(run.error));
        }
      }

      const cost = usage.getCurrent();
      metadata.set("status", "completed");
      metadata.set("completedAt", new Date().toISOString());
      metadata.set("succeeded", succeeded);
      metadata.set("failed", failed);
      metadata.set("totalBlocksIndexed", totalBlocks);
      metadata.set("totalAgentsDiscovered", totalAgents);
      metadata.set("computeCostCents", cost.totalCostInCents);
      metadata.set("durationMs", cost.compute.total.durationMs);

      logger.info(`Indexer cycle complete: ${succeeded}/${chains.length} chains, ${totalBlocks} blocks, ${totalAgents} agents`, {
        failures,
      });

      return { succeeded, failed, failures, totalBlocks, totalAgents };
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
