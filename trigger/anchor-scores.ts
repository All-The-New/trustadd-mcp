import { task, logger, metadata } from "@trigger.dev/sdk/v3";

export const anchorScoresTask = task({
  id: "anchor-scores",
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  queue: { concurrencyLimit: 1 },
  run: async (payload: { scoredAt: string; agentCount: number }) => {
    metadata.set("status", "running");
    metadata.set("startedAt", new Date().toISOString());

    const { db } = await import("../server/db");
    const { agents, trustAnchors } = await import("../shared/schema");
    const { sql, isNotNull } = await import("drizzle-orm");
    const { buildMerkleTree, extractProofs, publishRootOnChain } = await import("../server/anchor");
    const { METHODOLOGY_VERSION } = await import("../server/trust-provenance");

    // 1. Fetch all scored agents
    const scoredAgents = await db
      .select({
        id: agents.id,
        address: agents.primaryContractAddress,
        chainId: agents.chainId,
        score: agents.trustScore,
      })
      .from(agents)
      .where(isNotNull(agents.trustScore));

    if (scoredAgents.length === 0) {
      logger.warn("No scored agents found — skipping anchor");
      metadata.set("status", "skipped");
      return { skipped: true, reason: "no-scored-agents" };
    }

    metadata.set("agentsToAnchor", scoredAgents.length);
    logger.info(`Building Merkle tree for ${scoredAgents.length} agents`);

    // 2. Build Merkle tree
    const timestamp = Math.floor(new Date(payload.scoredAt).getTime() / 1000);
    const leafData = scoredAgents.map((a) => ({
      address: a.address,
      chainId: a.chainId,
      score: a.score!,
      methodologyVersion: METHODOLOGY_VERSION,
      timestamp,
    }));

    const tree = buildMerkleTree(leafData);
    const root = tree.root as `0x${string}`;
    metadata.set("merkleRoot", root);
    metadata.set("treeLeafCount", tree.length);
    logger.info(`Merkle root: ${root} (${tree.length} leaves)`);

    // 3. Publish on-chain (if configured)
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    const oracleKey = process.env.ORACLE_PRIVATE_KEY;
    const contractAddress = process.env.TRUST_ROOT_ADDRESS as `0x${string}` | undefined;

    if (oracleKey && contractAddress) {
      try {
        metadata.set("phase", "publishing-onchain");
        logger.info(`Publishing root to TrustRoot at ${contractAddress} on Base`);

        // Dynamic import viem — it's in build.external
        const { createWalletClient, createPublicClient, http } = await import("viem");
        const { privateKeyToAccount } = await import("viem/accounts");
        const { base } = await import("viem/chains");

        const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
        const account = privateKeyToAccount(`0x${oracleKey.replace(/^0x/, "")}`);

        const walletClient = createWalletClient({
          account,
          chain: base,
          transport: http(rpcUrl),
        });

        const publicClient = createPublicClient({
          chain: base,
          transport: http(rpcUrl),
        });

        const result = await publishRootOnChain({
          walletClient,
          publicClient,
          contractAddress,
          root,
          agentCount: scoredAgents.length,
          methodologyVersion: METHODOLOGY_VERSION,
        });

        txHash = result.txHash;
        blockNumber = result.blockNumber;
        metadata.set("txHash", txHash);
        metadata.set("blockNumber", blockNumber);
        logger.info(`Root published: tx=${txHash}, block=${blockNumber}`);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`On-chain publish failed: ${error.message}`);
        metadata.set("onChainError", error.message);
        // Continue — still store proofs locally
      }
    } else {
      logger.info("On-chain publish skipped: ORACLE_PRIVATE_KEY or TRUST_ROOT_ADDRESS not set");
      metadata.set("onChainSkipped", true);
    }

    // 4. Extract proofs and bulk-upsert
    metadata.set("phase", "storing-proofs");
    const proofs = extractProofs(tree, leafData);

    // Build agent address → id lookup
    const addressToId = new Map<string, string>();
    for (const a of scoredAgents) {
      addressToId.set(`${a.address.toLowerCase()}:${a.chainId}`, a.id);
    }

    // Batch upsert proofs in chunks of 500
    const BATCH_SIZE = 500;
    let upserted = 0;

    for (let i = 0; i < proofs.length; i += BATCH_SIZE) {
      const batch = proofs.slice(i, i + BATCH_SIZE);
      const values = batch.map((p) => {
        const agentId = addressToId.get(`${p.address}:${p.chainId}`);
        if (!agentId) return null;
        return {
          agentId,
          merkleRoot: root,
          merkleProof: p.proof,
          leafIndex: p.leafIndex,
          leafHash: p.leafHash,
          anchoredScore: p.score,
          anchoredMethodologyVersion: p.methodologyVersion,
          anchorTxHash: txHash,
          anchorBlockNumber: blockNumber,
          anchoredAt: new Date(payload.scoredAt),
        };
      }).filter(Boolean);

      if (values.length > 0) {
        await db.insert(trustAnchors)
          .values(values as any[])
          .onConflictDoUpdate({
            target: [trustAnchors.agentId],
            set: {
              merkleRoot: sql`excluded.merkle_root`,
              merkleProof: sql`excluded.merkle_proof`,
              leafIndex: sql`excluded.leaf_index`,
              leafHash: sql`excluded.leaf_hash`,
              anchoredScore: sql`excluded.anchored_score`,
              anchoredMethodologyVersion: sql`excluded.anchored_methodology_version`,
              anchorTxHash: sql`excluded.anchor_tx_hash`,
              anchorBlockNumber: sql`excluded.anchor_block_number`,
              anchoredAt: sql`excluded.anchored_at`,
            },
          });
        upserted += values.length;
      }

      if (i % 5000 === 0 && i > 0) {
        metadata.set("upsertedSoFar", upserted);
      }
    }

    metadata.set("status", "completed");
    metadata.set("completedAt", new Date().toISOString());
    metadata.set("proofsUpserted", upserted);

    logger.info(`Anchor complete: ${upserted} proofs stored, txHash=${txHash ?? "none"}`);

    try {
      const { recordSuccess } = await import("../server/pipeline-health");
      await recordSuccess("anchor-scores", "On-Chain Score Anchoring");
    } catch {}

    return {
      success: true,
      root,
      agentCount: scoredAgents.length,
      proofsUpserted: upserted,
      txHash,
      blockNumber,
    };
  },
});
