/**
 * Verdict Logic Tests (Methodology v2 — 5-tier verdict).
 *
 * Tests the `computeVerdict()` function with the v2 `VerdictInput` object.
 * Also tests `classifyAgent()` for quality tier + spam-flag assignment
 * (the classifier itself was untouched by the v2 rewrite).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { computeVerdict, type VerdictInput } from "../server/trust-report-compiler.js";
import { classifyAgent } from "../server/quality-classifier.js";

/** Helper — build a VerdictInput from a score + partial overrides. */
function verdict(
  score: number,
  overrides: Partial<Omit<VerdictInput, "score">> = {},
): ReturnType<typeof computeVerdict> {
  return computeVerdict({
    score,
    qualityTier: overrides.qualityTier ?? "low",
    spamFlags: overrides.spamFlags ?? [],
    lifecycleStatus: overrides.lifecycleStatus ?? "active",
  });
}

// ── computeVerdict() ─────────────────────────────────────────────────

describe("computeVerdict", () => {
  describe("VERIFIED (80-100)", () => {
    it("returns VERIFIED at boundary 80", () => {
      expect(verdict(80, { qualityTier: "high" })).toBe("VERIFIED");
    });
    it("returns VERIFIED at 100", () => {
      expect(verdict(100, { qualityTier: "high" })).toBe("VERIFIED");
    });
    it("returns VERIFIED for 95 with no negative evidence", () => {
      expect(verdict(95, { qualityTier: "high" })).toBe("VERIFIED");
    });
  });

  describe("TRUSTED (60-79)", () => {
    it("returns TRUSTED at boundary 60", () => {
      expect(verdict(60, { qualityTier: "high" })).toBe("TRUSTED");
    });
    it("returns TRUSTED at 79", () => {
      expect(verdict(79, { qualityTier: "medium" })).toBe("TRUSTED");
    });
  });

  describe("BUILDING (40-59)", () => {
    it("returns BUILDING at boundary 40", () => {
      expect(verdict(40, { qualityTier: "low" })).toBe("BUILDING");
    });
    it("returns BUILDING at 59", () => {
      expect(verdict(59, { qualityTier: "medium" })).toBe("BUILDING");
    });
  });

  describe("INSUFFICIENT (0-39)", () => {
    it("returns INSUFFICIENT at boundary 0", () => {
      expect(verdict(0, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 5", () => {
      expect(verdict(5, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 20", () => {
      expect(verdict(20, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
    it("returns INSUFFICIENT at 39 (upper boundary)", () => {
      expect(verdict(39, { qualityTier: "low" })).toBe("INSUFFICIENT");
    });
  });

  describe("FLAGGED — requires active negative evidence", () => {
    it("returns FLAGGED for spam tier even with high score", () => {
      expect(verdict(90, { qualityTier: "spam" })).toBe("FLAGGED");
    });
    it("returns FLAGGED for archived tier", () => {
      expect(verdict(70, { qualityTier: "archived" })).toBe("FLAGGED");
    });
    it("returns FLAGGED for archived lifecycle status", () => {
      expect(verdict(80, { qualityTier: "high", lifecycleStatus: "archived" })).toBe("FLAGGED");
    });
    it("returns FLAGGED for spam flags + score < 10", () => {
      expect(verdict(3, { spamFlags: ["test_agent"] })).toBe("FLAGGED");
    });
    it("returns FLAGGED for spam flags + score = 9", () => {
      expect(verdict(9, { spamFlags: ["test_agent"] })).toBe("FLAGGED");
    });

    it("does NOT return FLAGGED for low score alone (benefit of doubt)", () => {
      expect(verdict(3, { spamFlags: [] })).toBe("INSUFFICIENT");
      expect(verdict(0, { spamFlags: [] })).toBe("INSUFFICIENT");
    });
    it("does NOT return FLAGGED for score >= 10 with spam flags", () => {
      expect(verdict(15, { spamFlags: ["test_agent"] })).toBe("INSUFFICIENT");
    });
    it("does NOT return FLAGGED for score exactly 10 with spam flags", () => {
      expect(verdict(10, { spamFlags: ["test_agent"] })).toBe("INSUFFICIENT");
    });
  });

  describe("Precedence rules", () => {
    it("spam tier beats score >= 80", () => {
      expect(verdict(95, { qualityTier: "spam" })).toBe("FLAGGED");
    });
    it("archived lifecycle beats everything else", () => {
      expect(verdict(100, { qualityTier: "high", lifecycleStatus: "archived" })).toBe("FLAGGED");
    });
  });

  describe("Edge cases", () => {
    it("handles null qualityTier", () => {
      expect(verdict(50, { qualityTier: null as unknown as string })).toBe("BUILDING");
    });
    it("handles null spamFlags", () => {
      expect(verdict(70, { spamFlags: null as unknown as string[] })).toBe("TRUSTED");
    });
    it("handles null lifecycleStatus", () => {
      expect(verdict(70, { lifecycleStatus: null as unknown as string })).toBe("TRUSTED");
    });
    it("score 0 with no negative evidence = INSUFFICIENT", () => {
      expect(
        verdict(0, {
          qualityTier: null as unknown as string,
          spamFlags: null as unknown as string[],
          lifecycleStatus: null as unknown as string,
        }),
      ).toBe("INSUFFICIENT");
    });
  });

  describe("Deprecated tier removal", () => {
    it("never returns UNVERIFIED (removed in v2 consolidation)", () => {
      for (let score = 0; score <= 100; score += 5) {
        const v = verdict(score, { qualityTier: "low" });
        expect(v).not.toBe("UNVERIFIED");
        expect(v).not.toBe("INSUFFICIENT_DATA");
      }
    });
  });
});

// ── classifyAgent() — UNCHANGED from v1, still exercised here ────────

describe("classifyAgent", () => {
  describe("Spam detection", () => {
    it("flags test agent names", () => {
      const result = classifyAgent({
        name: "test",
        description: null,
        metadataUri: "https://example.com",
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result.spamFlags).toContain("test_agent");
      expect(result.qualityTier).toBe("spam");
    });

    it("flags spec URIs as spam", () => {
      const result = classifyAgent({
        name: "RealAgent",
        description: "desc",
        metadataUri: "https://eips.ethereum.org/EIPS/eip-8004",
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result.spamFlags).toContain("spec_uri");
      expect(result.qualityTier).toBe("spam");
    });

    it("flags blank URIs", () => {
      const result = classifyAgent({
        name: "Agent",
        description: "desc",
        metadataUri: null,
        trustScore: 20,
        createdAt: new Date(),
      });
      expect(result.spamFlags).toContain("blank_uri");
    });

    it("flags code-as-URI", () => {
      const result = classifyAgent({
        name: "Agent",
        description: "desc",
        metadataUri: "const x = require('ethers')",
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result.spamFlags).toContain("code_as_uri");
    });

    it("flags whitespace/empty names", () => {
      const result = classifyAgent({
        name: "   ",
        description: null,
        metadataUri: "https://x.com",
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result.spamFlags).toContain("whitespace_name");
    });

    it("flags duplicate fingerprints", () => {
      const fp = createHash("sha256").update("https://dupe.com").digest("hex").slice(0, 16);
      const dupeSet = new Set([fp]);
      const result = classifyAgent(
        {
          name: "Agent",
          description: "desc",
          metadataUri: "https://dupe.com",
          trustScore: 0,
          createdAt: new Date(),
        },
        dupeSet,
      );
      expect(result.spamFlags).toContain("duplicate_template");
    });

    it("deduplicates spam flags", () => {
      const result = classifyAgent({
        name: "test",
        description: "please do not disturb this test",
        metadataUri: "https://x.com",
        trustScore: 0,
        createdAt: new Date(),
      });
      const testFlags = result.spamFlags.filter(f => f === "test_agent");
      expect(testFlags.length).toBe(1);
    });
  });

  describe("Quality tier assignment", () => {
    it("classifies high tier for trust score >= 30 with no spam flags", () => {
      const result = classifyAgent({
        name: "Good Agent",
        description: "A proper description",
        metadataUri: "https://example.com/meta",
        trustScore: 35,
        createdAt: new Date(),
      });
      expect(result.qualityTier).toBe("high");
    });

    it("classifies medium tier for score 15-29 with name and description", () => {
      const result = classifyAgent({
        name: "OK Agent",
        description: "Some description",
        metadataUri: "https://example.com/meta",
        trustScore: 20,
        createdAt: new Date(),
      });
      expect(result.qualityTier).toBe("medium");
    });

    it("classifies low tier for score < 15 with no spam flags", () => {
      const result = classifyAgent({
        name: "New Agent",
        description: "Desc",
        metadataUri: "https://example.com/meta",
        trustScore: 10,
        createdAt: new Date(),
      });
      expect(result.qualityTier).toBe("low");
    });
  });

  describe("Lifecycle status", () => {
    it("archives spam agents older than 60 days", () => {
      const old = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
      const result = classifyAgent({
        name: "test",
        description: null,
        metadataUri: null,
        trustScore: 0,
        createdAt: old,
      });
      expect(result.qualityTier).toBe("archived");
      expect(result.lifecycleStatus).toBe("archived");
    });

    it("marks low-quality agents > 30 days as dormant", () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const result = classifyAgent({
        name: "SomeAgent",
        description: "d",
        metadataUri: "https://x.com",
        trustScore: 5,
        createdAt: old,
      });
      expect(result.lifecycleStatus).toBe("dormant");
    });

    it("marks fresh agents as active", () => {
      const result = classifyAgent({
        name: "FreshAgent",
        description: "desc",
        metadataUri: "https://x.com",
        trustScore: 50,
        createdAt: new Date(),
      });
      expect(result.lifecycleStatus).toBe("active");
    });
  });

  describe("Fingerprinting", () => {
    it("computes deterministic fingerprints from metadataUri", () => {
      const result1 = classifyAgent({
        name: "A",
        description: null,
        metadataUri: "https://test.com/meta",
        trustScore: 0,
        createdAt: new Date(),
      });
      const result2 = classifyAgent({
        name: "B",
        description: null,
        metadataUri: "https://test.com/meta",
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result1.metadataFingerprint).toBe(result2.metadataFingerprint);
      expect(result1.metadataFingerprint).toHaveLength(16);
    });

    it("returns null fingerprint for null/empty URI", () => {
      const result = classifyAgent({
        name: "A",
        description: null,
        metadataUri: null,
        trustScore: 0,
        createdAt: new Date(),
      });
      expect(result.metadataFingerprint).toBeNull();
    });
  });

  describe("Enrichment scheduling", () => {
    it("schedules high-tier enrichment every 6 hours", () => {
      const result = classifyAgent({
        name: "Great",
        description: "Long description for testing",
        metadataUri: "https://x.com",
        trustScore: 50,
        createdAt: new Date(),
      });
      const diffMs = result.nextEnrichmentAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(5 * 60 * 60 * 1000); // > 5h
      expect(diffMs).toBeLessThan(7 * 60 * 60 * 1000); // < 7h
    });

    it("schedules spam enrichment every 30 days", () => {
      const result = classifyAgent({
        name: "test",
        description: null,
        metadataUri: null,
        trustScore: 0,
        createdAt: new Date(),
      });
      const diffMs = result.nextEnrichmentAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });
  });
});
