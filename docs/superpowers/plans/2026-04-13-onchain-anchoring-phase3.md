# Trust Oracle Phase 3: On-Chain Score Anchoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a daily Merkle root of all agent trust scores to a `TrustRoot.sol` contract on Base, store per-agent proofs in the database, and expose proofs in the trust report API — enabling any on-chain consumer to verify a TrustAdd score without trusting our API.

**Architecture:** After the daily `recalculate-scores` task completes scoring, a new `anchor-scores` Trigger.dev task builds a `StandardMerkleTree` from all scored agents (leaves: `[address, chainId, score, methodologyVersion, timestamp]`), publishes the root to `TrustRoot.sol` on Base via viem, and bulk-upserts Merkle proofs into a `trust_anchors` table. The trust report API includes the proof in its `provenance` block. A separate `server/anchor.ts` module owns all Merkle tree and contract logic.

**Tech Stack:** `viem` (wallet/contract interaction), `@openzeppelin/merkle-tree` (StandardMerkleTree), Solidity (TrustRoot.sol ~30 lines), Drizzle ORM (schema), Vitest (tests)

**Scope boundary:** This plan covers contract design, the anchor module, schema, Trigger.dev task, and API integration. It stops short of deploying TrustRoot.sol to Base mainnet and funding the oracle wallet — those are manual infrastructure steps done after code review. The contract Solidity is written and tested in unit tests, but actual deployment is a follow-up.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `contracts/TrustRoot.sol` | Solidity contract — stores Merkle roots, emits events, owner-only writes |
| Create | `server/anchor.ts` | Merkle tree building, proof generation, contract ABI, `publishRoot()`, `buildMerkleTree()` |
| Create | `server/__tests__/anchor.test.ts` | Unit tests for Merkle tree building, leaf encoding, proof verification |
| Create | `trigger/anchor-scores.ts` | Trigger.dev task — orchestrates tree build, on-chain publish, DB upsert |
| Modify | `shared/schema.ts` | Add `trustAnchors` table (agent proofs + roots) |
| Modify | `server/trust-report-compiler.ts:106-111` | Add `anchor` block to `FullReportData.provenance` |
| Modify | `trigger/recalculate.ts:131-145` | Trigger anchor task after report recompilation |
| Modify | `trigger.config.ts:16-18` | Add `viem` to `build.external` |
| Modify | `package.json` | Add `viem`, `@openzeppelin/merkle-tree` dependencies |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `trigger.config.ts:16-18`

- [ ] **Step 1: Install viem and @openzeppelin/merkle-tree**

```bash
npm install viem @openzeppelin/merkle-tree
```

- [ ] **Step 2: Add viem to trigger.config.ts external packages**

In `trigger.config.ts`, the `build.external` array currently contains only `["pg"]`. Add `viem` — it's a large package with native dependencies that should not be bundled by esbuild.

```ts
// trigger.config.ts line 17
build: {
  external: ["pg", "viem"],
},
```

Do NOT add `@openzeppelin/merkle-tree` to external — it's small and bundles cleanly.

- [ ] **Step 3: Verify build still works**

```bash
npx tsc --noEmit
```

Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json trigger.config.ts
git commit -m "chore: add viem and @openzeppelin/merkle-tree for Phase 3 anchoring"
```

---

### Task 2: Write the TrustRoot.sol Contract

**Files:**
- Create: `contracts/TrustRoot.sol`

This is the on-chain contract that stores Merkle roots. It's minimal (~30 lines): owner-only `publishRoot()`, a mapping of roots, and an event. No on-chain Merkle verification — that's for Phase 4 (EAS attestations). Consumers call `roots(bytes32)` to check if a root was published and when.

- [ ] **Step 1: Create contracts directory and TrustRoot.sol**

```bash
mkdir -p contracts
```

Write `contracts/TrustRoot.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustRoot
 * @notice Stores Merkle roots of TrustAdd agent trust scores.
 *         Anyone can verify a score by checking a proof against a published root.
 * @dev Owner publishes a new root after each daily score recalculation.
 *      No on-chain proof verification — consumers verify off-chain or in their own contracts
 *      using OpenZeppelin MerkleProof.sol against `roots[root].timestamp`.
 */
contract TrustRoot {
    address public owner;

    struct RootEntry {
        uint64 timestamp;     // block.timestamp when published
        uint32 agentCount;    // number of agents in the tree
        uint16 methodology;   // methodology version (currently 1)
    }

    mapping(bytes32 => RootEntry) public roots;
    bytes32 public latestRoot;
    uint256 public rootCount;

    event RootPublished(
        bytes32 indexed root,
        uint256 agentCount,
        uint16 methodology,
        uint256 timestamp
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustRoot: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Publish a new Merkle root of agent trust scores.
     * @param root The Merkle root hash
     * @param agentCount Number of agents included in the tree
     * @param methodology Scoring methodology version
     */
    function publishRoot(
        bytes32 root,
        uint32 agentCount,
        uint16 methodology
    ) external onlyOwner {
        require(root != bytes32(0), "TrustRoot: empty root");
        require(roots[root].timestamp == 0, "TrustRoot: root already published");

        roots[root] = RootEntry({
            timestamp: uint64(block.timestamp),
            agentCount: agentCount,
            methodology: methodology
        });
        latestRoot = root;
        rootCount++;

        emit RootPublished(root, agentCount, methodology, block.timestamp);
    }

    /**
     * @notice Transfer ownership to a new address.
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TrustRoot: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add contracts/TrustRoot.sol
git commit -m "feat(contracts): add TrustRoot.sol — Merkle root storage on Base"
```

---

### Task 3: Add trust_anchors Schema

**Files:**
- Modify: `shared/schema.ts`

This table stores per-agent Merkle proofs and the root they belong to. One row per agent, upserted on each anchoring run.

- [ ] **Step 1: Write the failing type check**

Before modifying schema.ts, note the expected column names for later test steps. The table should have: `agentId`, `merkleRoot`, `merkleProof` (jsonb array of hex strings), `leafIndex`, `leafHash`, `anchoredScore`, `anchoredMethodologyVersion`, `anchorTxHash`, `anchorBlockNumber`, `anchoredAt`, `createdAt`.

- [ ] **Step 2: Add the trustAnchors table to shared/schema.ts**

Insert the following after the `trustReports` table definition (after line 401 `// --- End Trust Data Product ---`):

```ts
// --- Trust Score Anchoring (on-chain Merkle proofs) ---

export const trustAnchors = pgTable("trust_anchors", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  merkleRoot: text("merkle_root").notNull(),
  merkleProof: jsonb("merkle_proof").notNull(), // string[] of hex proof nodes
  leafIndex: integer("leaf_index").notNull(),
  leafHash: text("leaf_hash").notNull(),
  anchoredScore: integer("anchored_score").notNull(),
  anchoredMethodologyVersion: integer("anchored_methodology_version").notNull().default(1),
  anchorTxHash: text("anchor_tx_hash"),
  anchorBlockNumber: integer("anchor_block_number"),
  anchoredAt: timestamp("anchored_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_trust_anchor_agent").on(table.agentId),
  index("idx_trust_anchors_merkle_root").on(table.merkleRoot),
  index("idx_trust_anchors_anchored_at").on(table.anchoredAt),
]);

export const insertTrustAnchorSchema = createInsertSchema(trustAnchors).omit({
  id: true,
  createdAt: true,
});

export type TrustAnchor = typeof trustAnchors.$inferSelect;
export type InsertTrustAnchor = z.infer<typeof insertTrustAnchorSchema>;

// --- End Trust Score Anchoring ---
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS, no new type errors.

- [ ] **Step 4: Generate migration SQL**

```bash
npm run db:generate
```

This creates a new migration file in `migrations/`. Review the generated SQL to verify it creates the `trust_anchors` table with the expected columns and indexes.

- [ ] **Step 5: Apply migration via Supabase MCP**

Use the Supabase MCP `execute_sql` tool to run the generated migration SQL against the production database. Alternatively, copy the SQL from the generated migration file and run it via the Supabase SQL editor.

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts migrations/
git commit -m "feat(schema): add trust_anchors table for on-chain Merkle proofs"
```

---

### Task 4: Build the Anchor Module (Merkle Tree + Contract ABI)

**Files:**
- Create: `server/anchor.ts`
- Create: `server/__tests__/anchor.test.ts`

This is the core module. It has three responsibilities:
1. Build a `StandardMerkleTree` from scored agents
2. Extract per-agent proofs
3. Publish the root to TrustRoot.sol via viem (when called with a wallet client)

All functions are pure or accept injected dependencies for testability.

- [ ] **Step 1: Write failing tests for `encodeMerkleLeaf`**

Create `server/__tests__/anchor.test.ts`:

```ts
/**
 * On-Chain Score Anchoring Tests
 *
 * Tests Merkle tree building, leaf encoding, and proof extraction.
 * No network calls — all contract interaction is mocked.
 */
import { describe, it, expect } from "vitest";
import {
  encodeMerkleLeaf,
  buildMerkleTree,
  extractProofs,
  TRUST_ROOT_ABI,
} from "../anchor.js";

describe("encodeMerkleLeaf", () => {
  it("encodes an agent score into a 5-tuple leaf", () => {
    const leaf = encodeMerkleLeaf({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 8453,
      score: 72,
      methodologyVersion: 1,
      timestamp: 1713000000,
    });
    expect(leaf).toEqual([
      "0x1234567890abcdef1234567890abcdef12345678",
      8453,
      72,
      1,
      1713000000,
    ]);
  });

  it("lowercases the address for canonical ordering", () => {
    const leaf = encodeMerkleLeaf({
      address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      chainId: 1,
      score: 50,
      methodologyVersion: 1,
      timestamp: 1713000000,
    });
    expect(leaf[0]).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });
});

describe("buildMerkleTree", () => {
  const agents = [
    { address: "0x1111111111111111111111111111111111111111", chainId: 8453, score: 80, methodologyVersion: 1, timestamp: 1713000000 },
    { address: "0x2222222222222222222222222222222222222222", chainId: 8453, score: 45, methodologyVersion: 1, timestamp: 1713000000 },
    { address: "0x3333333333333333333333333333333333333333", chainId: 1, score: 60, methodologyVersion: 1, timestamp: 1713000000 },
  ];

  it("builds a tree with the correct number of leaves", () => {
    const tree = buildMerkleTree(agents);
    expect(tree.length).toBe(3);
  });

  it("produces a 32-byte hex root", () => {
    const tree = buildMerkleTree(agents);
    const root = tree.root;
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("produces a deterministic root for the same input", () => {
    const tree1 = buildMerkleTree(agents);
    const tree2 = buildMerkleTree(agents);
    expect(tree1.root).toBe(tree2.root);
  });

  it("produces a different root when scores change", () => {
    const modified = [...agents];
    modified[0] = { ...modified[0], score: 81 };
    const tree1 = buildMerkleTree(agents);
    const tree2 = buildMerkleTree(modified);
    expect(tree1.root).not.toBe(tree2.root);
  });

  it("throws for an empty agent list", () => {
    expect(() => buildMerkleTree([])).toThrow();
  });
});

describe("extractProofs", () => {
  const agents = [
    { address: "0x1111111111111111111111111111111111111111", chainId: 8453, score: 80, methodologyVersion: 1, timestamp: 1713000000 },
    { address: "0x2222222222222222222222222222222222222222", chainId: 8453, score: 45, methodologyVersion: 1, timestamp: 1713000000 },
  ];

  it("returns one proof per agent", () => {
    const tree = buildMerkleTree(agents);
    const proofs = extractProofs(tree, agents);
    expect(proofs).toHaveLength(2);
  });

  it("each proof has the expected structure", () => {
    const tree = buildMerkleTree(agents);
    const proofs = extractProofs(tree, agents);
    for (const p of proofs) {
      expect(p.address).toBeDefined();
      expect(p.chainId).toBeTypeOf("number");
      expect(p.proof).toBeInstanceOf(Array);
      expect(p.proof.length).toBeGreaterThan(0);
      expect(p.leafIndex).toBeTypeOf("number");
      expect(p.leafHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(p.root).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it("proofs verify against the tree root", () => {
    const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
    const tree = buildMerkleTree(agents);
    const proofs = extractProofs(tree, agents);
    for (const p of proofs) {
      const leaf = [p.address, p.chainId, p.score, p.methodologyVersion, p.timestamp];
      const verified = StandardMerkleTree.verify(
        tree.root,
        ["address", "uint256", "uint32", "uint16", "uint64"],
        leaf,
        p.proof,
      );
      expect(verified).toBe(true);
    }
  });
});

describe("TRUST_ROOT_ABI", () => {
  it("exports a non-empty ABI array", () => {
    expect(Array.isArray(TRUST_ROOT_ABI)).toBe(true);
    expect(TRUST_ROOT_ABI.length).toBeGreaterThan(0);
  });

  it("includes the publishRoot function", () => {
    const publishRoot = TRUST_ROOT_ABI.find(
      (item: any) => item.type === "function" && item.name === "publishRoot"
    );
    expect(publishRoot).toBeDefined();
    expect(publishRoot.inputs).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/__tests__/anchor.test.ts
```

Expected: FAIL — `server/anchor.js` does not exist.

- [ ] **Step 3: Implement server/anchor.ts**

Create `server/anchor.ts`:

```ts
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

/**
 * Leaf data for a single agent in the Merkle tree.
 */
export interface AnchorLeaf {
  address: string;
  chainId: number;
  score: number;
  methodologyVersion: number;
  timestamp: number;
}

/**
 * Extracted proof for one agent.
 */
export interface AnchorProof {
  address: string;
  chainId: number;
  score: number;
  methodologyVersion: number;
  timestamp: number;
  proof: string[];
  leafIndex: number;
  leafHash: string;
  root: string;
}

/** Solidity types for Merkle leaf encoding. */
const LEAF_ENCODING = ["address", "uint256", "uint32", "uint16", "uint64"] as const;

/**
 * Encode an agent's score data into a Merkle tree leaf tuple.
 * Address is lowercased for canonical ordering.
 */
export function encodeMerkleLeaf(leaf: AnchorLeaf): [string, number, number, number, number] {
  return [
    leaf.address.toLowerCase(),
    leaf.chainId,
    leaf.score,
    leaf.methodologyVersion,
    leaf.timestamp,
  ];
}

/**
 * Build a StandardMerkleTree from scored agents.
 * Throws if agents array is empty.
 */
export function buildMerkleTree(agents: AnchorLeaf[]): StandardMerkleTree<[string, number, number, number, number]> {
  if (agents.length === 0) {
    throw new Error("Cannot build Merkle tree from empty agent list");
  }
  const leaves = agents.map(encodeMerkleLeaf);
  return StandardMerkleTree.of(leaves, [...LEAF_ENCODING]);
}

/**
 * Extract per-agent Merkle proofs from a built tree.
 */
export function extractProofs(
  tree: StandardMerkleTree<[string, number, number, number, number]>,
  agents: AnchorLeaf[],
): AnchorProof[] {
  const root = tree.root;
  const proofs: AnchorProof[] = [];

  for (const [index, leaf] of tree.entries()) {
    const [address, chainId, score, methodologyVersion, timestamp] = leaf;
    proofs.push({
      address,
      chainId,
      score,
      methodologyVersion,
      timestamp,
      proof: tree.getProof(index),
      leafIndex: index,
      leafHash: tree.leafHash(index),
      root,
    });
  }

  return proofs;
}

/**
 * Minimal ABI for TrustRoot.sol — only the functions we call.
 */
export const TRUST_ROOT_ABI = [
  {
    type: "function",
    name: "publishRoot",
    inputs: [
      { name: "root", type: "bytes32", internalType: "bytes32" },
      { name: "agentCount", type: "uint32", internalType: "uint32" },
      { name: "methodology", type: "uint16", internalType: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "latestRoot",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "roots",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "timestamp", type: "uint64", internalType: "uint64" },
      { name: "agentCount", type: "uint32", internalType: "uint32" },
      { name: "methodology", type: "uint16", internalType: "uint16" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rootCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "RootPublished",
    inputs: [
      { name: "root", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "agentCount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "methodology", type: "uint16", indexed: false, internalType: "uint16" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;

/**
 * Publish a Merkle root to the TrustRoot contract on Base.
 *
 * This function requires viem WalletClient + PublicClient, which are
 * constructed in the Trigger.dev task (not here) to keep this module
 * testable without network dependencies.
 *
 * @returns Transaction hash of the publishRoot call
 */
export async function publishRootOnChain(opts: {
  walletClient: any; // viem WalletClient — typed as any for dynamic import compat
  publicClient: any; // viem PublicClient
  contractAddress: `0x${string}`;
  root: `0x${string}`;
  agentCount: number;
  methodologyVersion: number;
}): Promise<{ txHash: string; blockNumber: number }> {
  const { walletClient, publicClient, contractAddress, root, agentCount, methodologyVersion } = opts;

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: TRUST_ROOT_ABI,
    functionName: "publishRoot",
    args: [root, agentCount, methodologyVersion],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`publishRoot transaction reverted: ${hash}`);
  }

  return {
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/__tests__/anchor.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/anchor.ts server/__tests__/anchor.test.ts
git commit -m "feat: add anchor module — Merkle tree building, proof extraction, contract ABI"
```

---

### Task 5: Create the anchor-scores Trigger.dev Task

**Files:**
- Create: `trigger/anchor-scores.ts`

This task is triggered by `recalculate-scores` after report recompilation. It:
1. Queries all agents with scores
2. Builds a Merkle tree
3. Publishes root to TrustRoot.sol on Base (if `ORACLE_PRIVATE_KEY` and `TRUST_ROOT_ADDRESS` are set)
4. Bulk-upserts proofs into `trust_anchors`

The task is gated by env vars — if wallet config is missing, it skips on-chain publish and only stores proofs locally. This makes it safe to deploy before the contract is live.

- [ ] **Step 1: Create trigger/anchor-scores.ts**

```ts
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
    const { buildMerkleTree, extractProofs, publishRootOnChain, TRUST_ROOT_ABI } = await import("../server/anchor");
    const { METHODOLOGY_VERSION } = await import("../server/trust-provenance");
    const { log } = await import("../server/lib/log");

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
      // Key by lowercased address + chainId for uniqueness
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
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add trigger/anchor-scores.ts
git commit -m "feat: add anchor-scores Trigger.dev task — Merkle tree build + on-chain publish"
```

---

### Task 6: Wire Anchor Task into Recalculate Pipeline

**Files:**
- Modify: `trigger/recalculate.ts:113-145`

The anchor task should fire after report recompilation (Phase 4 of recalculate), using `trigger()` (fire-and-forget) — not `triggerAndWait()` — so it doesn't eat into the recalculate budget. The anchor task has its own 300s budget.

- [ ] **Step 1: Add anchor trigger to trigger/recalculate.ts**

After the report recompilation block (after line 130 `metadata.set("phaseRecompileMs", Date.now() - recompileStart);`), add:

```ts
      // Trigger on-chain score anchoring (fire-and-forget — runs in its own task)
      try {
        const { anchorScoresTask } = await import("./anchor-scores");
        await anchorScoresTask.trigger({
          scoredAt: new Date().toISOString(),
          agentCount: recalcResult.updated,
        });
        logger.info("Triggered anchor-scores task");
        metadata.set("anchorTriggered", true);
      } catch (err) {
        logger.error("Failed to trigger anchor-scores", { error: (err as Error).message });
        metadata.set("anchorTriggered", false);
      }
```

Place this code inside the main try block, after the report recompilation section and before the `const cost = usage.getCurrent();` line. No time budget check needed — `trigger()` is fire-and-forget and returns immediately.

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add trigger/recalculate.ts
git commit -m "feat: wire anchor-scores into daily recalculate pipeline (fire-and-forget)"
```

---

### Task 7: Add Anchor Data to Trust Report API

**Files:**
- Modify: `server/trust-report-compiler.ts`

Extend the `FullReportData.provenance` block with an optional `anchor` object containing the Merkle proof, root, and tx hash. This lets API consumers verify scores on-chain.

- [ ] **Step 1: Write a test for anchor data in trust reports**

Add to `__tests__/verdict-logic.test.ts` (or create a new test file `server/__tests__/trust-report-provenance.test.ts`):

```ts
import { describe, it, expect } from "vitest";

describe("FullReportData provenance.anchor", () => {
  it("anchor block is null when no anchor exists for agent", () => {
    // This tests the type contract — the actual data fetch is integration-level.
    // The provenance block should have: anchor: null | { root, proof, leafHash, txHash, blockNumber, anchoredAt }
    const provenance = {
      signalHash: "abc123",
      methodologyVersion: 1,
      scoredAt: "2026-04-13T05:00:00Z",
      disclaimer: "TrustAdd scores...",
      anchor: null,
    };
    expect(provenance.anchor).toBeNull();
  });

  it("anchor block contains expected fields when present", () => {
    const provenance = {
      signalHash: "abc123",
      methodologyVersion: 1,
      scoredAt: "2026-04-13T05:00:00Z",
      disclaimer: "TrustAdd scores...",
      anchor: {
        merkleRoot: "0x1234...",
        merkleProof: ["0xaaa...", "0xbbb..."],
        leafHash: "0xccc...",
        anchoredScore: 72,
        txHash: "0xddd...",
        blockNumber: 12345678,
        anchoredAt: "2026-04-13T05:01:00Z",
        contractAddress: "0xeee...",
        chain: "base",
        verificationUrl: "https://basescan.org/tx/0xddd...",
      },
    };
    expect(provenance.anchor.merkleRoot).toBeDefined();
    expect(provenance.anchor.merkleProof).toBeInstanceOf(Array);
    expect(provenance.anchor.txHash).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (type contract test)**

```bash
npx vitest run server/__tests__/trust-report-provenance.test.ts
```

Expected: PASS (these are structural contract tests).

- [ ] **Step 3: Update FullReportData type in trust-report-compiler.ts**

In `server/trust-report-compiler.ts`, modify the `provenance` block in `FullReportData` (lines 106-111):

Replace:
```ts
  provenance: {
    signalHash: string | null;
    methodologyVersion: number;
    scoredAt: string | null;
    disclaimer: string;
  };
```

With:
```ts
  provenance: {
    signalHash: string | null;
    methodologyVersion: number;
    scoredAt: string | null;
    disclaimer: string;
    anchor: {
      merkleRoot: string;
      merkleProof: string[];
      leafHash: string;
      anchoredScore: number;
      txHash: string | null;
      blockNumber: number | null;
      anchoredAt: string;
      contractAddress: string;
      chain: string;
      verificationUrl: string | null;
    } | null;
  };
```

- [ ] **Step 4: Update compileAndCacheReport to fetch anchor data**

Find the section in `compileAndCacheReport()` where the `provenance` block is assembled (search for `provenance:` in the function body). Add a query to fetch the agent's trust anchor and include it.

Add near the top of `compileAndCacheReport`, after existing data fetches:

```ts
    // Fetch on-chain anchor proof (if available)
    const [anchorRow] = await db
      .select()
      .from(trustAnchors)
      .where(eq(trustAnchors.agentId, agent.id))
      .limit(1);
```

Make sure to add `trustAnchors` to the imports from `../shared/schema.js` at the top of the file.

Then update the provenance block assembly to include:

```ts
    const trustRootAddress = process.env.TRUST_ROOT_ADDRESS ?? "";
    provenance: {
      signalHash: agent.trustSignalHash ?? null,
      methodologyVersion: agent.trustMethodologyVersion ?? 1,
      scoredAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
      disclaimer: "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.",
      anchor: anchorRow ? {
        merkleRoot: anchorRow.merkleRoot,
        merkleProof: anchorRow.merkleProof as string[],
        leafHash: anchorRow.leafHash,
        anchoredScore: anchorRow.anchoredScore,
        txHash: anchorRow.anchorTxHash,
        blockNumber: anchorRow.anchorBlockNumber,
        anchoredAt: anchorRow.anchoredAt.toISOString(),
        contractAddress: trustRootAddress,
        chain: "base",
        verificationUrl: anchorRow.anchorTxHash
          ? `https://basescan.org/tx/${anchorRow.anchorTxHash}`
          : null,
      } : null,
    },
```

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All 184+ tests pass (existing tests should not break since `anchor: null` is the default when no anchor row exists).

- [ ] **Step 7: Commit**

```bash
git add server/trust-report-compiler.ts server/__tests__/trust-report-provenance.test.ts
git commit -m "feat: add on-chain anchor proof to trust report provenance block"
```

---

### Task 8: Environment Variable Documentation

**Files:**
- Modify: `docs/principles/future-phases.md` — update Phase 3 status

No code changes — this task documents the required infrastructure setup.

- [ ] **Step 1: Document required env vars**

The following environment variables are needed in Trigger.dev (Settings > Environment Variables > Production):

| Variable | Description | Required for |
|----------|-------------|--------------|
| `ORACLE_PRIVATE_KEY` | Private key of the oracle wallet (hex, without 0x prefix) | On-chain publish |
| `TRUST_ROOT_ADDRESS` | Deployed TrustRoot.sol contract address on Base | On-chain publish |
| `BASE_RPC_URL` | Base mainnet RPC URL (defaults to `https://mainnet.base.org`) | On-chain publish |

Without `ORACLE_PRIVATE_KEY` and `TRUST_ROOT_ADDRESS`, the anchor task still runs — it builds the tree and stores proofs locally, but skips on-chain publishing. This is the default behavior until the contract is deployed.

- [ ] **Step 2: Update Phase 3 status in future-phases.md**

In `docs/principles/future-phases.md`, update the Phase 3 section:

```markdown
## Phase 3: On-Chain Score Anchoring (Principles 3, 14)

**Status:** Code complete — pending contract deployment
**Completed:** 2026-04-13 (code), deployment TBD
**Dependencies:** Phase 1 complete, funded oracle wallet on Base
```

- [ ] **Step 3: Commit**

```bash
git add docs/principles/future-phases.md
git commit -m "docs: update Phase 3 status, document oracle env vars"
```

---

### Task 9: Integration Verification

This task verifies everything works end-to-end before the contract is deployed (local-only mode).

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests pass, including the new anchor tests.

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Verify Trigger.dev task is discoverable**

Check that `anchor-scores` appears in the Trigger.dev task list. Use the Trigger.dev MCP to verify:
- Task `anchor-scores` is registered
- Task `recalculate-scores` still runs correctly

- [ ] **Step 4: Verify the anchor task runs in local-only mode**

When `ORACLE_PRIVATE_KEY` is not set, the task should:
1. Build the Merkle tree successfully
2. Log "On-chain publish skipped"
3. Store proofs in `trust_anchors` table
4. Return `{ success: true, txHash: null }`

- [ ] **Step 5: Verify trust report API includes anchor field**

After the anchor task runs, check that `/api/v1/trust/:address/report` includes `provenance.anchor` (either the proof object or `null`).

---

## Post-Plan Infrastructure Steps (Manual)

These are NOT automated tasks — they require manual execution after code review:

1. **Deploy TrustRoot.sol to Base mainnet** — Use Foundry or Hardhat. Constructor sets deployer as owner.
2. **Fund oracle wallet** — Send ~0.01 ETH on Base to the oracle address. Lasts months at ~$0.01/day.
3. **Set environment variables** — Add `ORACLE_PRIVATE_KEY`, `TRUST_ROOT_ADDRESS`, and optionally `BASE_RPC_URL` to Trigger.dev production env vars.
4. **Verify first anchoring run** — After the next daily recalculate (5 AM UTC), check:
   - `trust_anchors` table has rows
   - Transaction appears on BaseScan
   - Trust report API shows `provenance.anchor` with proof data

---

## Cost Estimate

- **Gas per root publish**: ~22,000 gas on Base (~$0.01 at current gas prices)
- **Daily cost**: ~$0.01/day = ~$3.65/year
- **Database**: One row per agent in `trust_anchors` (~100K rows, ~50MB with proofs)
- **Compute**: Merkle tree of 100K agents builds in <2 seconds
