import { describe, it, expect } from "vitest";

describe("FullReportData provenance.anchor", () => {
  it("anchor block is null when no anchor exists for agent", () => {
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
    expect(provenance.anchor.leafHash).toBeDefined();
    expect(provenance.anchor.anchoredScore).toBe(72);
    expect(provenance.anchor.blockNumber).toBe(12345678);
    expect(provenance.anchor.anchoredAt).toBeDefined();
    expect(provenance.anchor.contractAddress).toBeDefined();
    expect(provenance.anchor.chain).toBe("base");
    expect(provenance.anchor.verificationUrl).toContain("basescan.org");
  });

  it("verificationUrl is null when txHash is null", () => {
    const anchor = {
      merkleRoot: "0x1234...",
      merkleProof: ["0xaaa..."],
      leafHash: "0xccc...",
      anchoredScore: 55,
      txHash: null,
      blockNumber: null,
      anchoredAt: "2026-04-13T05:01:00Z",
      contractAddress: "0xeee...",
      chain: "base",
      verificationUrl: null,
    };
    expect(anchor.txHash).toBeNull();
    expect(anchor.verificationUrl).toBeNull();
  });
});
