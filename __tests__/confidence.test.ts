/**
 * Confidence Scoring Tests (Methodology v2 — 6 sources, rebalanced weights).
 *
 * Tests the `computeConfidence()` function for levels, source counting,
 * missing labels, and consistency penalty application.
 *
 * v2 weights: identity 0.20, transactions 0.25, attestations 0.15,
 * probes 0.15, github 0.15, farcaster 0.10 — sum 1.0.
 */
import { describe, it, expect } from "vitest";
import { computeConfidence } from "../server/trust-confidence.js";

describe("computeConfidence", () => {
  describe("Confidence levels", () => {
    it("returns 'high' confidence when all 6 sources are active", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: true,
        hasAttestations: true,
        hasGithub: true,
        hasFarcaster: true,
      });
      expect(result.level).toBe("high");
      expect(result.score).toBeCloseTo(1.0, 5);
      expect(result.sourcesActive).toBe(6);
      expect(result.missing).toHaveLength(0);
    });

    it("returns 'medium' confidence with identity + transactions + attestations (behavioral-first = 0.60)", () => {
      const result = computeConfidence({
        hasIdentity: true,      // 0.20
        hasProbes: false,
        hasTransactions: true,  // 0.25
        hasAttestations: true,  // 0.15
        hasGithub: false,
        hasFarcaster: false,
      });
      // 0.20 + 0.25 + 0.15 = 0.60 → medium (>=0.45, <0.7)
      expect(result.level).toBe("medium");
      expect(result.score).toBeCloseTo(0.60, 5);
      expect(result.sourcesActive).toBe(3);
    });

    it("returns 'medium' with identity + transactions + github (= 0.60)", () => {
      const result = computeConfidence({
        hasIdentity: true,      // 0.20
        hasProbes: false,
        hasTransactions: true,  // 0.25
        hasAttestations: false,
        hasGithub: true,        // 0.15
        hasFarcaster: false,
      });
      expect(result.level).toBe("medium");
      expect(result.score).toBeCloseTo(0.60, 5);
    });

    it("returns 'low' confidence with identity only (0.20)", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: false,
        hasTransactions: false,
        hasAttestations: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      // 0.20 — exactly at low-tier boundary (>=0.2, <0.45)
      expect(result.level).toBe("low");
      expect(result.score).toBeCloseTo(0.20, 5);
    });

    it("returns 'minimal' confidence with no sources", () => {
      const result = computeConfidence({
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasAttestations: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.level).toBe("minimal");
      expect(result.score).toBe(0);
      expect(result.sourcesActive).toBe(0);
      expect(result.missing).toHaveLength(6);
    });

    it("returns 'minimal' for farcaster-only (0.10 < 0.2 low threshold)", () => {
      const result = computeConfidence({
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasAttestations: false,
        hasGithub: false,
        hasFarcaster: true,
      });
      expect(result.level).toBe("minimal");
      expect(result.score).toBeCloseTo(0.10, 5);
    });
  });

  describe("Missing sources", () => {
    it("lists all 5 missing sources when only identity is active", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: false,
        hasTransactions: false,
        hasAttestations: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.missing).toContain("x402_probes");
      expect(result.missing).toContain("transactions");
      expect(result.missing).toContain("attestations");
      expect(result.missing).toContain("github");
      expect(result.missing).toContain("farcaster");
      expect(result.missing).not.toContain("identity");
      expect(result.missing).toHaveLength(5);
    });

    it("lists attestations as a missing label when absent", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: true,
        hasAttestations: false,
        hasGithub: true,
        hasFarcaster: true,
      });
      expect(result.missing).toContain("attestations");
    });
  });

  describe("Consistency penalties", () => {
    it("applies penalty for x402 claimed but no transactions", () => {
      const result = computeConfidence(
        {
          hasIdentity: true,
          hasProbes: true,
          hasTransactions: false,
          hasAttestations: true,
          hasGithub: true,
          hasFarcaster: true,
        },
        { x402ActiveButNoTransactions: true },
      );
      expect(result.flags).toContain("x402_claimed_no_transactions");
      // Everything except transactions: 0.20+0.15+0.15+0.15+0.10 = 0.75, -0.05 penalty = 0.70
      expect(result.score).toBeCloseTo(0.70, 5);
    });

    it("applies penalty for endpoints declared but all fail", () => {
      const result = computeConfidence(
        {
          hasIdentity: true,
          hasProbes: true,
          hasTransactions: true,
          hasAttestations: true,
          hasGithub: true,
          hasFarcaster: true,
        },
        { endpointsDeclaredButAllFail: true },
      );
      expect(result.flags).toContain("endpoints_unreachable");
      expect(result.score).toBeCloseTo(1.0 - 0.05, 5);
    });

    it("applies both penalties cumulatively", () => {
      const result = computeConfidence(
        {
          hasIdentity: true,
          hasProbes: true,
          hasTransactions: true,
          hasAttestations: true,
          hasGithub: true,
          hasFarcaster: true,
        },
        { x402ActiveButNoTransactions: true, endpointsDeclaredButAllFail: true },
      );
      expect(result.flags).toHaveLength(2);
      expect(result.score).toBeCloseTo(1.0 - 0.10, 5);
    });

    it("does not apply penalties when flags are absent", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: true,
        hasAttestations: true,
        hasGithub: true,
        hasFarcaster: true,
      });
      expect(result.flags).toHaveLength(0);
      expect(result.score).toBeCloseTo(1.0, 5);
    });

    it("clamps score to 0 (never negative) even with penalties", () => {
      const result = computeConfidence(
        {
          hasIdentity: false,
          hasProbes: false,
          hasTransactions: false,
          hasAttestations: false,
          hasGithub: false,
          hasFarcaster: false,
        },
        { x402ActiveButNoTransactions: true, endpointsDeclaredButAllFail: true },
      );
      expect(result.score).toBe(0);
    });
  });

  describe("sourcesTotal", () => {
    it("always reports 6 total sources (v2 adds attestations)", () => {
      const result = computeConfidence({
        hasIdentity: false,
        hasProbes: false,
        hasTransactions: false,
        hasAttestations: false,
        hasGithub: false,
        hasFarcaster: false,
      });
      expect(result.sourcesTotal).toBe(6);
    });

    it("reports 6 total even when all sources active", () => {
      const result = computeConfidence({
        hasIdentity: true,
        hasProbes: true,
        hasTransactions: true,
        hasAttestations: true,
        hasGithub: true,
        hasFarcaster: true,
      });
      expect(result.sourcesTotal).toBe(6);
    });
  });
});
