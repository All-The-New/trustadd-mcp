/**
 * Free Tier Redaction Tests (P0)
 *
 * Tests that `redactAgentForPublic()` correctly strips trust-intelligence fields
 * and injects verdict + reportAvailable for free-tier API responses.
 * No database required — pure function test.
 */
import { describe, it, expect } from "vitest";
import { redactAgentForPublic } from "../server/routes.js";
import {
  TRUSTED_AGENT,
  CAUTION_AGENT,
  SPAM_AGENT,
  UNKNOWN_AGENT,
} from "./fixtures/agents.js";

/** The 5 fields that MUST be stripped from free tier responses. */
const PROTECTED_FIELDS = [
  "trustScoreBreakdown",
  "trustScoreUpdatedAt",
  "qualityTier",
  "spamFlags",
  "lifecycleStatus",
];

/** Fields that MUST be injected into free tier responses. */
const INJECTED_FIELDS = ["verdict", "reportAvailable"];

describe("redactAgentForPublic", () => {
  describe("Field stripping", () => {
    it("strips all 5 protected fields from a trusted agent", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      for (const field of PROTECTED_FIELDS) {
        expect(redacted).not.toHaveProperty(field);
      }
    });

    it("strips all 5 protected fields from a spam agent", () => {
      const redacted = redactAgentForPublic(SPAM_AGENT as unknown as Record<string, unknown>);
      for (const field of PROTECTED_FIELDS) {
        expect(redacted).not.toHaveProperty(field);
      }
    });

    it("strips all 5 protected fields from an unknown agent", () => {
      const redacted = redactAgentForPublic(UNKNOWN_AGENT as unknown as Record<string, unknown>);
      for (const field of PROTECTED_FIELDS) {
        expect(redacted).not.toHaveProperty(field);
      }
    });
  });

  describe("Field injection", () => {
    it("injects verdict field", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted).toHaveProperty("verdict");
      expect(typeof redacted.verdict).toBe("string");
    });

    it("injects reportAvailable as true", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.reportAvailable).toBe(true);
    });

    it("sets correct verdict for trusted agent", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.verdict).toBe("TRUSTED");
    });

    it("sets correct verdict for caution agent (score 35 → BUILDING under current v2 calibration)", () => {
      const redacted = redactAgentForPublic(CAUTION_AGENT as unknown as Record<string, unknown>);
      expect(redacted.verdict).toBe("BUILDING");
    });

    it("sets correct verdict for spam agent (qualityTier='spam' → FLAGGED)", () => {
      const redacted = redactAgentForPublic(SPAM_AGENT as unknown as Record<string, unknown>);
      expect(redacted.verdict).toBe("FLAGGED");
    });

    it("sets UNKNOWN verdict for agent with null trustScore", () => {
      const redacted = redactAgentForPublic(UNKNOWN_AGENT as unknown as Record<string, unknown>);
      expect(redacted.verdict).toBe("UNKNOWN");
    });
  });

  describe("Public field preservation", () => {
    it("preserves id", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.id).toBe(TRUSTED_AGENT.id);
    });

    it("preserves name", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.name).toBe(TRUSTED_AGENT.name);
    });

    it("preserves chainId", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.chainId).toBe(TRUSTED_AGENT.chainId);
    });

    it("preserves primaryContractAddress", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.primaryContractAddress).toBe(TRUSTED_AGENT.primaryContractAddress);
    });

    it("preserves description", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.description).toBe(TRUSTED_AGENT.description);
    });

    it("preserves imageUrl", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.imageUrl).toBe(TRUSTED_AGENT.imageUrl);
    });

    it("preserves trustScore (v2 policy: aggregate score visible for leaderboard stamp)", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted.trustScore).toBe(TRUSTED_AGENT.trustScore);
    });
  });

  describe("Protected field absence", () => {
    it("trustScoreBreakdown is not present in redacted output", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted).not.toHaveProperty("trustScoreBreakdown");
    });

    it("quality tier string is not present in redacted output", () => {
      const redacted = redactAgentForPublic(TRUSTED_AGENT as unknown as Record<string, unknown>);
      expect(redacted).not.toHaveProperty("qualityTier");
    });

    it("spam flags array is not present in redacted output", () => {
      const redacted = redactAgentForPublic(SPAM_AGENT as unknown as Record<string, unknown>);
      expect(redacted).not.toHaveProperty("spamFlags");
    });
  });
});
