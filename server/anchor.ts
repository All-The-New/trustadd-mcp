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

  for (const [index, leaf] of Array.from(tree.entries())) {
    const [address, chainId, score, methodologyVersion, timestamp] = leaf;
    proofs.push({
      address,
      chainId,
      score,
      methodologyVersion,
      timestamp,
      proof: tree.getProof(index),
      leafIndex: index,
      leafHash: (tree as any)._leafHash(index),
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
