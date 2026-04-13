import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../trust-score";

describe("calculateTrustScore", () => {
  it("returns zero for empty agent", () => {
    const agent = {
      id: "test-1",
      erc8004Id: "1",
      primaryContractAddress: "0x0",
      controllerAddress: "0x0",
      chainId: 8453,
      claimed: false,
      firstSeenBlock: 0,
      lastUpdatedBlock: 0,
      name: null,
      description: null,
      capabilities: null,
      metadataUri: null,
      tags: null,
      oasfSkills: null,
      oasfDomains: null,
      endpoints: null,
      x402Support: null,
      supportedTrust: null,
      imageUrl: null,
      activeStatus: null,
      slug: null,
      trustScore: null,
      trustScoreBreakdown: null,
      trustScoreUpdatedAt: null,
      qualityTier: "unclassified",
      spamFlags: [],
      lifecycleStatus: "active",
      metadataFingerprint: null,
      nextEnrichmentAt: null,
      lastQualityEvaluatedAt: null,
      createdAt: new Date(),
    };
    const result = calculateTrustScore(agent);
    expect(result.total).toBe(0);
    expect(result.identity).toBe(0);
  });

  it("awards identity points for name and description", () => {
    const agent = {
      id: "test-2",
      erc8004Id: "2",
      primaryContractAddress: "0x1",
      controllerAddress: "0x1",
      chainId: 8453,
      claimed: false,
      firstSeenBlock: 0,
      lastUpdatedBlock: 0,
      name: "TestAgent",
      description: "A comprehensive test agent with a description that is over one hundred characters long for the full five points in the scoring rubric.",
      capabilities: null,
      metadataUri: null,
      tags: ["test"],
      oasfSkills: null,
      oasfDomains: null,
      endpoints: null,
      x402Support: null,
      supportedTrust: null,
      imageUrl: null,
      activeStatus: null,
      slug: null,
      trustScore: null,
      trustScoreBreakdown: null,
      trustScoreUpdatedAt: null,
      qualityTier: "unclassified",
      spamFlags: [],
      lifecycleStatus: "active",
      metadataFingerprint: null,
      nextEnrichmentAt: null,
      lastQualityEvaluatedAt: null,
      createdAt: new Date(),
    };
    const result = calculateTrustScore(agent);
    expect(result.identity).toBe(15); // name=5 + desc=5 + tags=5
  });
});
