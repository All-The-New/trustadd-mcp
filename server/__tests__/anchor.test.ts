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
    const proofs = extractProofs(tree);
    expect(proofs).toHaveLength(2);
  });

  it("each proof has the expected structure", () => {
    const tree = buildMerkleTree(agents);
    const proofs = extractProofs(tree);
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
    const proofs = extractProofs(tree);
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
    expect(publishRoot!.inputs).toHaveLength(3);
  });
});
