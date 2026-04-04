import { task, logger, metadata, wait } from "@trigger.dev/sdk/v3";

export const chainIndexerTask = task({
  id: "chain-indexer",
  maxDuration: 180,
  retry: { maxAttempts: 2 },
  queue: { concurrencyLimit: 5 },
  run: async (payload: { chainId: number; chainName: string }) => {
    const { startSingleChainImmediate } = await import("../server/indexer.js");

    metadata.set("status", "indexing");
    metadata.set("chainId", payload.chainId);
    metadata.set("chainName", payload.chainName);
    metadata.set("startedAt", new Date().toISOString());

    // First index cycle
    const result = await startSingleChainImmediate(payload.chainId);
    metadata.set("cycle1_blocksIndexed", result.blocksIndexed);
    metadata.set("cycle1_agentsDiscovered", result.agentsDiscovered);

    if (!result.success) {
      metadata.set("status", "failed");
      metadata.set("error", result.error ?? "unknown error");
      logger.error(`Chain ${payload.chainName} cycle 1 failed`, { error: result.error });
      return result;
    }

    logger.info(`Chain ${payload.chainName} cycle 1 complete`, {
      blocksIndexed: result.blocksIndexed,
      agentsDiscovered: result.agentsDiscovered,
    });

    // Checkpointed wait — FREE compute (doesn't count toward usage)
    metadata.set("status", "waiting");
    await wait.for({ seconds: 90 });

    // Second index cycle after wait
    metadata.set("status", "second-cycle");
    const result2 = await startSingleChainImmediate(payload.chainId);
    metadata.set("cycle2_blocksIndexed", result2.blocksIndexed);
    metadata.set("cycle2_agentsDiscovered", result2.agentsDiscovered);

    if (!result2.success) {
      logger.warn(`Chain ${payload.chainName} cycle 2 failed (cycle 1 succeeded)`, { error: result2.error });
    }

    const totalBlocks = result.blocksIndexed + result2.blocksIndexed;
    const totalAgents = result.agentsDiscovered + result2.agentsDiscovered;

    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("totalBlocksIndexed", totalBlocks);
    metadata.set("totalAgentsDiscovered", totalAgents);

    return {
      success: true,
      chainId: payload.chainId,
      chainName: payload.chainName,
      totalBlocksIndexed: totalBlocks,
      totalAgentsDiscovered: totalAgents,
      cycles: [result, result2],
    };
  },
});
