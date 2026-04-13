import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../trust-score";

// Shared minimal agent fixture (mirrors trust-score.test.ts)
const emptyAgent = {
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

const richAgent = {
  ...emptyAgent,
  id: "test-rich",
  name: "TrustAgent",
  description:
    "A comprehensive test agent with a description that is over one hundred characters long for the full five points in the scoring rubric.",
  imageUrl: "https://example.com/avatar.png",
  endpoints: [{ url: "https://api.example.com" }, { url: "https://api2.example.com" }, { url: "https://api3.example.com" }],
  tags: ["defi", "trading"],
  oasfSkills: ["swap", "lend"],
  oasfDomains: ["finance"],
  x402Support: true,
  metadataUri: "ipfs://QmTest",
  supportedTrust: ["eip712", "erc7710", "erc7715"],
  activeStatus: true,
  createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
};

const richFeedback = {
  agentId: "test-rich",
  githubHealthScore: 75,
  farcasterScore: 0.8,
  totalSources: 3,
  id: "fb-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("calculateTrustScore — signals array", () => {
  it("returns a signals array", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it("returns a non-empty signals array for an empty agent", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it("every signal has dimension, name, points, earned, and maxPoints", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    for (const signal of result.signals) {
      expect(typeof signal.dimension).toBe("string");
      expect(typeof signal.name).toBe("string");
      expect(typeof signal.points).toBe("number");
      expect(typeof signal.maxPoints).toBe("number");
      expect(typeof signal.earned).toBe("boolean");
    }
  });

  it("signal earned flag is consistent with points > 0", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    for (const signal of result.signals) {
      if (signal.earned) {
        expect(signal.points).toBeGreaterThan(0);
      } else {
        expect(signal.points).toBe(0);
      }
    }
  });

  it("signal points never exceed maxPoints", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    for (const signal of result.signals) {
      expect(signal.points).toBeLessThanOrEqual(signal.maxPoints);
      expect(signal.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains all required signal names", () => {
    const requiredSignals = [
      "agent_name",
      "description_quality",
      "image_url",
      "endpoints_declared",
      "tags_or_skills",
      "agent_age",
      "metadata_updates",
      "cross_chain_presence",
      "x402_payment",
      "oasf_skills",
      "endpoint_count",
      "github_health",
      "farcaster_presence",
      "community_sources",
      "metadata_storage",
      "trust_protocols",
      "active_status",
    ];
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const signalNames = result.signals.map((s) => s.name);
    for (const name of requiredSignals) {
      expect(signalNames).toContain(name);
    }
  });

  it("signals sum per dimension matches identity total", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const identitySum = result.signals
      .filter((s) => s.dimension === "identity")
      .reduce((acc, s) => acc + s.points, 0);
    expect(identitySum).toBe(result.identity);
  });

  it("signals sum per dimension matches history total", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const historySum = result.signals
      .filter((s) => s.dimension === "history")
      .reduce((acc, s) => acc + s.points, 0);
    expect(historySum).toBe(result.history);
  });

  it("signals sum per dimension matches capability total", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const capabilitySum = result.signals
      .filter((s) => s.dimension === "capability")
      .reduce((acc, s) => acc + s.points, 0);
    expect(capabilitySum).toBe(result.capability);
  });

  it("signals sum per dimension matches community total", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const communitySum = result.signals
      .filter((s) => s.dimension === "community")
      .reduce((acc, s) => acc + s.points, 0);
    expect(communitySum).toBe(result.community);
  });

  it("signals sum per dimension matches transparency total", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const transparencySum = result.signals
      .filter((s) => s.dimension === "transparency")
      .reduce((acc, s) => acc + s.points, 0);
    expect(transparencySum).toBe(result.transparency);
  });

  it("sum of all signals matches total score", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const allSignalsSum = result.signals.reduce((acc, s) => acc + s.points, 0);
    expect(allSignalsSum).toBe(result.total);
  });

  it("signals sum per dimension matches totals for empty agent", () => {
    const result = calculateTrustScore(emptyAgent);
    for (const dim of ["identity", "history", "capability", "community", "transparency"] as const) {
      const sum = result.signals
        .filter((s) => s.dimension === dim)
        .reduce((acc, s) => acc + s.points, 0);
      expect(sum).toBe(result[dim]);
    }
  });
});

describe("calculateTrustScore — opportunities array", () => {
  it("returns an opportunities array", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(Array.isArray(result.opportunities)).toBe(true);
  });

  it("opportunities include unearned signals with maxPoints >= 3", () => {
    const result = calculateTrustScore(emptyAgent);
    for (const opp of result.opportunities) {
      const matchingSignal = result.signals.find((s) => s.name === opp.signal);
      expect(matchingSignal).toBeDefined();
      expect(matchingSignal!.earned).toBe(false);
      expect(matchingSignal!.maxPoints).toBeGreaterThanOrEqual(3);
    }
  });

  it("opportunity hints are non-empty strings", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(result.opportunities.length).toBeGreaterThan(0);
    for (const opp of result.opportunities) {
      expect(typeof opp.hint).toBe("string");
      expect(opp.hint.length).toBeGreaterThan(0);
    }
  });

  it("opportunity has signal, dimension, maxPoints, and hint fields", () => {
    const result = calculateTrustScore(emptyAgent);
    for (const opp of result.opportunities) {
      expect(typeof opp.signal).toBe("string");
      expect(typeof opp.dimension).toBe("string");
      expect(typeof opp.maxPoints).toBe("number");
      expect(typeof opp.hint).toBe("string");
    }
  });

  it("fully-scored rich agent has fewer opportunities than empty agent", () => {
    const richResult = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const emptyResult = calculateTrustScore(emptyAgent);
    expect(richResult.opportunities.length).toBeLessThan(emptyResult.opportunities.length);
  });

  it("signals that are earned are not in opportunities", () => {
    const result = calculateTrustScore(richAgent, richFeedback, 3, 4);
    const earnedNames = new Set(result.signals.filter((s) => s.earned).map((s) => s.name));
    for (const opp of result.opportunities) {
      expect(earnedNames.has(opp.signal)).toBe(false);
    }
  });
});

describe("calculateTrustScore — backward compatibility", () => {
  it("returns zero total for empty agent (unchanged)", () => {
    const result = calculateTrustScore(emptyAgent);
    expect(result.total).toBe(0);
    expect(result.identity).toBe(0);
    expect(result.history).toBe(0);
    expect(result.capability).toBe(0);
    expect(result.community).toBe(0);
    expect(result.transparency).toBe(0);
  });

  it("awards identity=15 for agent with name, long description, and tags (unchanged)", () => {
    const agent = {
      ...emptyAgent,
      id: "test-2",
      name: "TestAgent",
      description:
        "A comprehensive test agent with a description that is over one hundred characters long for the full five points in the scoring rubric.",
      tags: ["test"],
    };
    const result = calculateTrustScore(agent);
    expect(result.identity).toBe(15); // name=5 + desc=5 + tags=5
  });

  it("awards history points for 30+ day old agent with updates and cross-chain presence", () => {
    const agent = {
      ...emptyAgent,
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    };
    const result = calculateTrustScore(agent, null, 2, 3);
    expect(result.history).toBe(20); // age=10 + updates=5 + crossChain=5
  });

  it("awards capability points for x402, skills, and endpoints", () => {
    const agent = {
      ...emptyAgent,
      x402Support: true,
      oasfSkills: ["swap", "lend"],
      oasfDomains: ["finance"],
      endpoints: [{ url: "a" }, { url: "b" }, { url: "c" }],
    };
    const result = calculateTrustScore(agent);
    expect(result.capability).toBe(15); // x402=5 + skills=5 + endpoints=5
  });

  it("awards transparency points for ipfs uri, trust protocols, and active status", () => {
    const agent = {
      ...emptyAgent,
      metadataUri: "ipfs://QmTest",
      supportedTrust: ["eip712", "erc7710", "erc7715"],
      activeStatus: true,
    };
    const result = calculateTrustScore(agent);
    expect(result.transparency).toBe(20); // ipfs=8 + protocols(3)=7 + active=5
  });

  it("awards community points for feedback (github + farcaster + sources)", () => {
    const result = calculateTrustScore(emptyAgent, richFeedback, 0, 0);
    expect(result.community).toBe(20); // github=10 + farcaster=5 + sources=5
  });
});
