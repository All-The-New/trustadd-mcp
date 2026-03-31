import { ethers } from "ethers";
import { CHAIN_CONFIGS, getRpcUrls } from "../shared/chains.js";
import { db } from "../server/db.js";
import { agents } from "../shared/schema.js";
import { sql, desc, eq } from "drizzle-orm";

const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const REPUTATION_ABI = [
  "event FeedbackPosted(uint256 indexed agentId, address indexed reviewer, bytes32 indexed feedbackHash, string feedbackURI)",
];

const ALL_CHAINS = [8453, 1, 42161];
const TARGET_CHAINS = process.argv.includes("--all-chains") ? ALL_CHAINS : [8453];
const CHUNK_SIZE = 10_000;
const TOTAL_LOOKBACK = 50_000;

async function getProvider(chainId: number): Promise<ethers.JsonRpcProvider | null> {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) return null;
  const urls = getRpcUrls(config);
  if (!urls.primary) return null;
  return new ethers.JsonRpcProvider(urls.primary);
}

async function discoverFeedbackSources(chainId: number) {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    console.log(`  Chain ${chainId} not configured, skipping`);
    return;
  }

  const provider = await getProvider(chainId);
  if (!provider) {
    console.log(`  No RPC URL available for ${config.name}, skipping`);
    return;
  }

  console.log(`\n=== ${config.name} (chain ${chainId}) ===`);

  const currentBlock = await provider.getBlockNumber();
  console.log(`  Current block: ${currentBlock}`);

  const reputationIface = new ethers.Interface(REPUTATION_ABI);
  const feedbackTopic = reputationIface.getEvent("FeedbackPosted")!.topicHash;

  const startBlock = Math.max(0, currentBlock - TOTAL_LOOKBACK);
  console.log(`  Scanning FeedbackPosted events from block ${startBlock} to ${currentBlock} (${CHUNK_SIZE}-block chunks)...`);

  const allLogs: ethers.Log[] = [];

  for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
    try {
      const logs = await provider.getLogs({
        address: REPUTATION_REGISTRY,
        topics: [feedbackTopic],
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...logs);
    } catch (err) {
      console.log(`  Warning: chunk ${from}-${to} failed: ${(err as Error).message}`);
    }
  }

  console.log(`  Found ${allLogs.length} FeedbackPosted events total`);

  if (allLogs.length > 0) {
    const reviewerCounts: Record<string, number> = {};
    const agentCounts: Record<string, number> = {};

    for (const log of allLogs) {
      const parsed = reputationIface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;
      const reviewer = parsed.args[1] as string;
      const agentId = (parsed.args[0] as bigint).toString();
      reviewerCounts[reviewer.toLowerCase()] = (reviewerCounts[reviewer.toLowerCase()] ?? 0) + 1;
      agentCounts[agentId] = (agentCounts[agentId] ?? 0) + 1;
    }

    console.log(`\n  Top reviewer addresses (potential oracles):`);
    const sortedReviewers = Object.entries(reviewerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    for (const [addr, count] of sortedReviewers) {
      console.log(`    ${addr} — ${count} feedback events`);
    }

    console.log(`\n  Top agents by feedback count:`);
    const sortedAgents = Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    for (const [id, count] of sortedAgents) {
      console.log(`    Agent #${id} — ${count} feedback events`);
    }
  }
}

async function discoverControllerAddresses() {
  console.log(`\n=== Top Controller Addresses on Base (from DB) ===`);

  try {
    const baseResults = await db
      .select({
        controllerAddress: agents.controllerAddress,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(agents)
      .where(eq(agents.chainId, 8453))
      .groupBy(agents.controllerAddress)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    console.log(`  Top 20 controller addresses on Base:\n`);
    for (const row of baseResults) {
      console.log(`    ${row.controllerAddress} — ${row.count} agents`);
    }
  } catch (err) {
    console.log(`  Error querying Base controllers: ${(err as Error).message}`);
  }

  console.log(`\n=== Top Controller Addresses (all chains) ===`);

  try {
    const allResults = await db
      .select({
        controllerAddress: agents.controllerAddress,
        chainId: agents.chainId,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(agents)
      .groupBy(agents.controllerAddress, agents.chainId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    for (const row of allResults) {
      const chainName = CHAIN_CONFIGS[row.chainId]?.name ?? `chain ${row.chainId}`;
      console.log(`  ${row.controllerAddress} — ${row.count} agents on ${chainName}`);
    }
  } catch (err) {
    console.log(`  Error querying all-chain controllers: ${(err as Error).message}`);
  }
}

async function main() {
  console.log("=== Reputation Source Discovery Tool ===");
  console.log(`  Reputation Registry: ${REPUTATION_REGISTRY}`);
  console.log(`  Target chains: ${TARGET_CHAINS.map((id) => CHAIN_CONFIGS[id]?.name ?? id).join(", ")}`);

  for (const chainId of TARGET_CHAINS) {
    await discoverFeedbackSources(chainId);
  }

  await discoverControllerAddresses();

  console.log("\n=== Discovery Complete ===");
  console.log("Use the top reviewer addresses above to update KNOWN_SOURCES in server/known-reputation-sources.ts");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
