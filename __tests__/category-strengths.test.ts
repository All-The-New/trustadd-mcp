import { describe, it, expect } from "vitest";
import { deriveCategoryStrengths, type CategoryStrengths } from "../server/trust-categories.js";
import type { TrustScoreBreakdown } from "../server/trust-score.js";

function breakdown(overrides: Partial<TrustScoreBreakdown["categories"]> = {}): TrustScoreBreakdown {
  return {
    total: 0,
    categories: {
      transactions: 0,
      reputation: 0,
      profile: 0,
      longevity: 0,
      community: 0,
      ...overrides,
    },
    signals: [],
    opportunities: [],
  };
}

describe("deriveCategoryStrengths", () => {
  it("returns all 5 keys", () => {
    const s = deriveCategoryStrengths(breakdown(), 0);
    const keys: (keyof CategoryStrengths)[] = ["identity", "behavioral", "community", "authenticity", "attestation"];
    for (const k of keys) expect(s).toHaveProperty(k);
  });

  it("empty breakdown + zero sybil risk → mostly none, authenticity high", () => {
    const s = deriveCategoryStrengths(breakdown(), 0);
    expect(s.identity).toBe("none");
    expect(s.behavioral).toBe("none");
    expect(s.community).toBe("none");
    expect(s.attestation).toBe("none");
    expect(s.authenticity).toBe("high");
  });

  it("maxed profile (15/15) → identity high", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 15 }), 0).identity).toBe("high");
  });

  it("profile 9/15 (60%) → identity medium", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 9 }), 0).identity).toBe("medium");
  });

  it("profile 1/15 (6.6%) → identity low", () => {
    expect(deriveCategoryStrengths(breakdown({ profile: 1 }), 0).identity).toBe("low");
  });

  it("behavioral combines transactions + longevity normalised against 50", () => {
    // 25+10 = 35/50 = 70% → high
    expect(deriveCategoryStrengths(breakdown({ transactions: 25, longevity: 10 }), 0).behavioral).toBe("high");
    // 10+5 = 15/50 = 30% → low
    expect(deriveCategoryStrengths(breakdown({ transactions: 10, longevity: 5 }), 0).behavioral).toBe("low");
  });

  it("community 7/10 (70%) → community high", () => {
    expect(deriveCategoryStrengths(breakdown({ community: 7 }), 0).community).toBe("high");
  });

  it("reputation (attestation) always 'none' when value is 0", () => {
    expect(deriveCategoryStrengths(breakdown({ reputation: 0 }), 0).attestation).toBe("none");
  });

  it("authenticity bucketed by sybilRiskScore (0–1 float scale)", () => {
    expect(deriveCategoryStrengths(breakdown(), 0).authenticity).toBe("high");
    expect(deriveCategoryStrengths(breakdown(), 0.15).authenticity).toBe("medium");
    expect(deriveCategoryStrengths(breakdown(), 0.45).authenticity).toBe("low");
    expect(deriveCategoryStrengths(breakdown(), 0.8).authenticity).toBe("none");
  });

  it("authenticity boundaries are exact", () => {
    // Just below / at 0.3 boundary
    expect(deriveCategoryStrengths(breakdown(), 0.29).authenticity).toBe("medium");
    expect(deriveCategoryStrengths(breakdown(), 0.3).authenticity).toBe("low");
    // Just below / at 0.6 boundary
    expect(deriveCategoryStrengths(breakdown(), 0.59).authenticity).toBe("low");
    expect(deriveCategoryStrengths(breakdown(), 0.6).authenticity).toBe("none");
  });

  it("null sybilRiskScore treated as 0 (high authenticity)", () => {
    expect(deriveCategoryStrengths(breakdown(), null).authenticity).toBe("high");
  });
});
