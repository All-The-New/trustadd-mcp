import { describe, it, expect } from "vitest";
import { computeConfidence } from "../trust-confidence";

describe("computeConfidence", () => {
  it("returns 'minimal' confidence with no data sources", () => {
    const result = computeConfidence({
      hasIdentity: false,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    });
    expect(result.level).toBe("minimal");
    expect(result.score).toBeLessThan(0.2);
    expect(result.sourcesActive).toBe(0);
    expect(result.sourcesTotal).toBe(5);
  });

  it("returns 'high' confidence with all 5 sources active", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: true,
      hasGithub: true,
      hasFarcaster: true,
    });
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.sourcesActive).toBe(5);
    expect(result.sourcesTotal).toBe(5);
  });

  it("returns 'medium' confidence with identity + github + farcaster (3 sources)", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: true,
      hasFarcaster: true,
    });
    expect(result.level).toBe("medium");
    expect(result.score).toBeGreaterThanOrEqual(0.45);
    expect(result.score).toBeLessThan(0.7);
    expect(result.sourcesActive).toBe(3);
  });

  it("lists correct missing sources when some are inactive", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: true,
      hasFarcaster: false,
    });
    expect(result.missing).toContain("x402_probes");
    expect(result.missing).toContain("transactions");
    expect(result.missing).toContain("farcaster");
    expect(result.missing).not.toContain("identity");
    expect(result.missing).not.toContain("github");
  });

  it("includes consistency flags when x402ActiveButNoTransactions is true", () => {
    const result = computeConfidence(
      {
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      },
      { x402ActiveButNoTransactions: true }
    );
    expect(result.flags).toContain("x402_claimed_no_transactions");
  });

  it("includes consistency flags when endpointsDeclaredButAllFail is true", () => {
    const result = computeConfidence(
      {
        hasIdentity: true,
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      },
      { endpointsDeclaredButAllFail: true }
    );
    expect(result.flags).toContain("endpoints_unreachable");
  });

  it("consistency flags reduce score by 0.05 each", () => {
    const baseResult = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    });
    const flaggedResult = computeConfidence(
      {
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      },
      { x402ActiveButNoTransactions: true }
    );
    expect(flaggedResult.score).toBeCloseTo(baseResult.score - 0.05, 5);
  });

  it("score cannot go below 0 from consistency penalties", () => {
    const result = computeConfidence(
      {
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      },
      { x402ActiveButNoTransactions: true, endpointsDeclaredButAllFail: true }
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("missing array is empty when all sources are active", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: true,
      hasTransactions: true,
      hasGithub: true,
      hasFarcaster: true,
    });
    expect(result.missing).toHaveLength(0);
  });

  it("flags array is empty when no consistency flags provided", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    });
    expect(result.flags).toHaveLength(0);
  });

  it("returns 'low' confidence with only identity source (weight 0.30)", () => {
    const result = computeConfidence({
      hasIdentity: true,
      hasProbes: false,
      hasTransactions: false,
      hasGithub: false,
      hasFarcaster: false,
    });
    // identity weight = 0.30 → score = 0.30 → "low" (0.20 <= 0.30 < 0.45)
    expect(result.level).toBe("low");
    expect(result.score).toBeCloseTo(0.3, 5);
  });
});
