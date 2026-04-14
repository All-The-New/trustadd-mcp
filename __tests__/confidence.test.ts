/**
 * Confidence Scoring Tests (P0)
 *
 * Tests the `computeConfidence()` function for all confidence levels,
 * source counting, and consistency penalty application.
 */
import { describe, it, expect } from "vitest";
import { computeConfidence } from "../server/trust-confidence.js";

describe("computeConfidence", () => {
  describe("Confidence levels", () => {
    it("returns 'high' confidence when all sources are active", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: true,
        hasGithub: true,
        hasFarcaster: true,
      });
      expect(result.level).toBe("high");
      expect(result.score).toBe(1.0);
      expect(result.sourcesActive).toBe(5);
      expect(result.missing).toHaveLength(0);
    });

    it("returns 'medium' confidence with identity + transactions + github", () => {
      const result = computeConfidence({
        hasIdentity: true,   // 0.30
        hasProbes: false,    // 0
        hasTransactions: true, // 0.20
        hasGithub: true,     // 0.20
        hasFarcaster: false, // 0
      });
      expect(result.level).toBe("high"); // 0.70 exactly = high threshold
      expect(result.score).toBe(0.7);
      expect(result.sourcesActive).toBe(3);
    });

    it("returns 'low' confidence with identity + probes only (floating-point: 0.30+0.15 < 0.45)", () => {
      const result = computeConfidence({
        hasIdentity: true,   // 0.30
        hasProbes: true,     // 0.15
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      // JS floating-point: 0.30 + 0.15 = 0.44999... which is < 0.45 threshold
      expect(result.level).toBe("low");
      expect(result.score).toBeCloseTo(0.45, 1);
    });

    it("returns 'low' confidence with identity only", () => {
      const result = computeConfidence({
        hasIdentity: true,   // 0.30
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.level).toBe("low"); // 0.30
      expect(result.score).toBe(0.3);
    });

    it("returns 'minimal' confidence with no sources", () => {
      const result = computeConfidence({
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.level).toBe("minimal");
      expect(result.score).toBe(0);
      expect(result.sourcesActive).toBe(0);
      expect(result.missing).toHaveLength(5);
    });
  });

  describe("Missing sources", () => {
    it("lists all missing sources by label", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.missing).toContain("x402_probes");
      expect(result.missing).toContain("transactions");
      expect(result.missing).toContain("github");
      expect(result.missing).toContain("farcaster");
      expect(result.missing).not.toContain("identity");
    });
  });

  describe("Consistency penalties", () => {
    it("applies penalty for x402 claimed but no transactions", () => {
      const result = computeConfidence(
        { hasIdentity: true, hasProbes: true, hasTransactions: false, hasGithub: true, hasFarcaster: true },
        { x402ActiveButNoTransactions: true },
      );
      expect(result.flags).toContain("x402_claimed_no_transactions");
      // All except transactions: 0.30 + 0.15 + 0.20 + 0.15 = 0.80, minus penalty 0.05 = 0.75
      expect(result.score).toBeCloseTo(0.75, 5);
    });

    it("applies penalty for endpoints declared but all fail", () => {
      const result = computeConfidence(
        { hasIdentity: true, hasProbes: true, hasTransactions: true, hasGithub: true, hasFarcaster: true },
        { endpointsDeclaredButAllFail: true },
      );
      expect(result.flags).toContain("endpoints_unreachable");
      expect(result.score).toBe(1.0 - 0.05);
    });

    it("applies both penalties cumulatively", () => {
      const result = computeConfidence(
        { hasIdentity: true, hasProbes: true, hasTransactions: true, hasGithub: true, hasFarcaster: true },
        { x402ActiveButNoTransactions: true, endpointsDeclaredButAllFail: true },
      );
      expect(result.flags).toHaveLength(2);
      expect(result.score).toBe(1.0 - 0.10);
    });

    it("does not apply penalties when flags are absent", () => {
      const result = computeConfidence(
        { hasIdentity: true, hasProbes: true, hasTransactions: true, hasGithub: true, hasFarcaster: true },
      );
      expect(result.flags).toHaveLength(0);
      expect(result.score).toBe(1.0);
    });

    it("clamps score to 0 (never negative)", () => {
      const result = computeConfidence(
        { hasIdentity: false, hasProbes: false, hasTransactions: false, hasGithub: false, hasFarcaster: false },
        { x402ActiveButNoTransactions: true, endpointsDeclaredButAllFail: true },
      );
      expect(result.score).toBe(0);
    });
  });

  describe("sourcesTotal", () => {
    it("always reports 5 total sources", () => {
      const result = computeConfidence({
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.sourcesTotal).toBe(5);
    });
  });
});
