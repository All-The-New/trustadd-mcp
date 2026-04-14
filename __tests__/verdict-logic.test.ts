/**
 * Verdict Logic Tests (P0)
 *
 * Tests the `computeVerdict()` function for all verdict outcomes and edge cases.
 * Tests `classifyAgent()` for quality tier and spam flag classification.
 * No database required — pure function tests.
 */
import { describe, it, expect } from "vitest";
import { computeVerdict } from "../server/trust-report-compiler.js";
import { classifyAgent } from "../server/quality-classifier.js";
import {
  TRUSTED_AGENT,
  CAUTION_AGENT,
  SPAM_AGENT,
  UNKNOWN_AGENT,
  ARCHIVED_AGENT,
  BOUNDARY_TRUSTED,
  BOUNDARY_CAUTION,
  BOUNDARY_UNTRUSTED,
  HIGH_SCORE_WITH_FLAGS,
} from "./fixtures/agents.js";

// ── computeVerdict() ─────────────────────────────────────────────────

describe("computeVerdict", () => {
  describe("TRUSTED verdict", () => {
    it("returns TRUSTED for score >= 60, high tier, no flags", () => {
      expect(computeVerdict(72, "high", [], "active")).toBe("TRUSTED");
    });

    it("returns TRUSTED for score >= 60, medium tier, no flags", () => {
      expect(computeVerdict(65, "medium", [], "active")).toBe("TRUSTED");
    });

    it("returns TRUSTED at boundary score of 60", () => {
      expect(computeVerdict(60, "high", [], "active")).toBe("TRUSTED");
    });
  });

  describe("CAUTION verdict", () => {
    it("returns CAUTION for score 30-59", () => {
      expect(computeVerdict(45, "medium", [], "active")).toBe("CAUTION");
    });

    it("returns CAUTION for score at boundary 30", () => {
      expect(computeVerdict(30, "low", [], "active")).toBe("CAUTION");
    });

    it("returns CAUTION for high score with spam flags (flags override)", () => {
      expect(computeVerdict(80, "high", ["duplicate_template"], "active")).toBe("CAUTION");
    });

    it("returns CAUTION for score 59 with high tier (just below TRUSTED)", () => {
      expect(computeVerdict(59, "high", [], "active")).toBe("CAUTION");
    });

    it("returns CAUTION for score 60 with low tier", () => {
      expect(computeVerdict(60, "low", [], "active")).toBe("CAUTION");
    });
  });

  describe("UNTRUSTED verdict", () => {
    it("returns UNTRUSTED for score < 30", () => {
      expect(computeVerdict(29, "low", [], "active")).toBe("UNTRUSTED");
    });

    it("returns UNTRUSTED for score 0", () => {
      expect(computeVerdict(0, "low", [], "active")).toBe("UNTRUSTED");
    });

    it("returns UNTRUSTED for spam tier regardless of score", () => {
      expect(computeVerdict(80, "spam", [], "active")).toBe("UNTRUSTED");
    });

    it("returns UNTRUSTED for archived tier regardless of score", () => {
      expect(computeVerdict(90, "archived", [], "active")).toBe("UNTRUSTED");
    });

    it("returns UNTRUSTED for archived lifecycle status", () => {
      expect(computeVerdict(70, "high", [], "archived")).toBe("UNTRUSTED");
    });
  });

  describe("Precedence rules", () => {
    it("UNTRUSTED overrides CAUTION when both conditions apply", () => {
      // spam tier + score 50 → UNTRUSTED wins
      expect(computeVerdict(50, "spam", [], "active")).toBe("UNTRUSTED");
    });

    it("spam tier overrides high score + no flags", () => {
      expect(computeVerdict(95, "spam", [], "active")).toBe("UNTRUSTED");
    });

    it("archived status overrides everything", () => {
      expect(computeVerdict(100, "high", [], "archived")).toBe("UNTRUSTED");
    });
  });

  describe("Edge cases", () => {
    it("handles null tier gracefully", () => {
      expect(computeVerdict(50, null, [], "active")).toBe("CAUTION");
    });

    it("handles null flags gracefully", () => {
      expect(computeVerdict(70, "high", null, "active")).toBe("TRUSTED");
    });

    it("handles null lifecycle status gracefully", () => {
      expect(computeVerdict(70, "high", [], null)).toBe("TRUSTED");
    });

    it("handles all nulls gracefully", () => {
      expect(computeVerdict(50, null, null, null)).toBe("CAUTION");
    });
  });
});

// ── classifyAgent() ──────────────────────────────────────────────────

describe("classifyAgent", () => {
  describe("Spam detection", () => {
    it("flags test agent names", () => {
      const result = classifyAgent({ name: "test", description: null, metadataUri: "https://example.com", trustScore: 0, createdAt: new Date() });
      expect(result.spamFlags).toContain("test_agent");
      expect(result.qualityTier).toBe("spam");
    });

    it("flags spec URIs as spam", () => {
      const result = classifyAgent({ name: "RealAgent", description: "desc", metadataUri: "https://eips.ethereum.org/EIPS/eip-8004", trustScore: 0, createdAt: new Date() });
      expect(result.spamFlags).toContain("spec_uri");
      expect(result.qualityTier).toBe("spam");
    });

    it("flags blank URIs", () => {
      const result = classifyAgent({ name: "Agent", description: "desc", metadataUri: null, trustScore: 20, createdAt: new Date() });
      expect(result.spamFlags).toContain("blank_uri");
    });

    it("flags code-as-URI", () => {
      const result = classifyAgent({ name: "Agent", description: "desc", metadataUri: "const x = require('ethers')", trustScore: 0, createdAt: new Date() });
      expect(result.spamFlags).toContain("code_as_uri");
    });

    it("flags whitespace/empty names", () => {
      const result = classifyAgent({ name: "   ", description: null, metadataUri: "https://x.com", trustScore: 0, createdAt: new Date() });
      expect(result.spamFlags).toContain("whitespace_name");
    });

    it("flags duplicate fingerprints", () => {
      const dupes = new Set(["a1b2c3d4e5f6a7b8"]); // Matches sha256 of "https://example.com"
      const fp = require("crypto").createHash("sha256").update("https://dupe.com").digest("hex").slice(0, 16);
      const dupeSet = new Set([fp]);
      const result = classifyAgent({ name: "Agent", description: "desc", metadataUri: "https://dupe.com", trustScore: 0, createdAt: new Date() }, dupeSet);
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
      // "test_agent" should appear only once even though both name and description match
      const testFlags = result.spamFlags.filter(f => f === "test_agent");
      expect(testFlags.length).toBe(1);
    });
  });

  describe("Quality tier assignment", () => {
    it("classifies high tier for trust score >= 30 with no spam flags", () => {
      const result = classifyAgent({ name: "Good Agent", description: "A proper description", metadataUri: "https://example.com/meta", trustScore: 35, createdAt: new Date() });
      expect(result.qualityTier).toBe("high");
    });

    it("classifies medium tier for score 15-29 with name and description", () => {
      const result = classifyAgent({ name: "OK Agent", description: "Some description", metadataUri: "https://example.com/meta", trustScore: 20, createdAt: new Date() });
      expect(result.qualityTier).toBe("medium");
    });

    it("classifies low tier for score < 15 with no spam flags", () => {
      const result = classifyAgent({ name: "New Agent", description: "Desc", metadataUri: "https://example.com/meta", trustScore: 10, createdAt: new Date() });
      expect(result.qualityTier).toBe("low");
    });
  });

  describe("Lifecycle status", () => {
    it("archives spam agents older than 60 days", () => {
      const old = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
      const result = classifyAgent({ name: "test", description: null, metadataUri: null, trustScore: 0, createdAt: old });
      expect(result.qualityTier).toBe("archived");
      expect(result.lifecycleStatus).toBe("archived");
    });

    it("marks low-quality agents > 30 days as dormant", () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const result = classifyAgent({ name: "SomeAgent", description: "d", metadataUri: "https://x.com", trustScore: 5, createdAt: old });
      expect(result.lifecycleStatus).toBe("dormant");
    });

    it("marks fresh agents as active", () => {
      const result = classifyAgent({ name: "FreshAgent", description: "desc", metadataUri: "https://x.com", trustScore: 50, createdAt: new Date() });
      expect(result.lifecycleStatus).toBe("active");
    });
  });

  describe("Fingerprinting", () => {
    it("computes deterministic fingerprints from metadataUri", () => {
      const result1 = classifyAgent({ name: "A", description: null, metadataUri: "https://test.com/meta", trustScore: 0, createdAt: new Date() });
      const result2 = classifyAgent({ name: "B", description: null, metadataUri: "https://test.com/meta", trustScore: 0, createdAt: new Date() });
      expect(result1.metadataFingerprint).toBe(result2.metadataFingerprint);
      expect(result1.metadataFingerprint).toHaveLength(16);
    });

    it("returns null fingerprint for null/empty URI", () => {
      const result = classifyAgent({ name: "A", description: null, metadataUri: null, trustScore: 0, createdAt: new Date() });
      expect(result.metadataFingerprint).toBeNull();
    });
  });

  describe("Enrichment scheduling", () => {
    it("schedules high-tier enrichment every 6 hours", () => {
      const result = classifyAgent({ name: "Great", description: "Long description for testing", metadataUri: "https://x.com", trustScore: 50, createdAt: new Date() });
      const diffMs = result.nextEnrichmentAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(5 * 60 * 60 * 1000); // > 5h
      expect(diffMs).toBeLessThan(7 * 60 * 60 * 1000);    // < 7h
    });

    it("schedules spam enrichment every 30 days", () => {
      const result = classifyAgent({ name: "test", description: null, metadataUri: null, trustScore: 0, createdAt: new Date() });
      const diffMs = result.nextEnrichmentAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });
  });
});
