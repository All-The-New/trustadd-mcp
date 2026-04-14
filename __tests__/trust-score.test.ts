/**
 * Trust Score Calculation Tests (P0)
 *
 * Tests the pure `calculateTrustScore()` function with known agent profiles.
 * No database required — all inputs are fixtures.
 */
import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../server/trust-score.js";
import {
  TRUSTED_AGENT,
  CAUTION_AGENT,
  SPAM_AGENT,
  UNKNOWN_AGENT,
  TRUSTED_FEEDBACK,
  NO_FEEDBACK,
} from "./fixtures/agents.js";

describe("calculateTrustScore", () => {
  // ── Dimension: Identity (max 25) ───────────────────────────────────

  describe("Identity dimension", () => {
    it("awards 5 points for a non-empty name", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const nameSignal = result.signals.find(s => s.name === "agent_name");
      expect(nameSignal?.points).toBe(5);
      expect(nameSignal?.earned).toBe(true);
    });

    it("awards 0 points for null name", () => {
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      const nameSignal = result.signals.find(s => s.name === "agent_name");
      expect(nameSignal?.points).toBe(0);
      expect(nameSignal?.earned).toBe(false);
    });

    it("awards 5 points for description >= 100 chars", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const descSignal = result.signals.find(s => s.name === "description_quality");
      expect(descSignal?.points).toBe(5);
    });

    it("awards 3 points for description 30-99 chars", () => {
      const result = calculateTrustScore(CAUTION_AGENT, NO_FEEDBACK, 0, 0);
      const descSignal = result.signals.find(s => s.name === "description_quality");
      expect(descSignal?.points).toBe(3);
    });

    it("awards 0 for null description", () => {
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      const descSignal = result.signals.find(s => s.name === "description_quality");
      expect(descSignal?.points).toBe(0);
    });

    it("awards 5 points for valid image URL", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const imgSignal = result.signals.find(s => s.name === "image_url");
      expect(imgSignal?.points).toBe(5);
      expect(imgSignal?.earned).toBe(true);
    });

    it("awards 0 for null imageUrl", () => {
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      const imgSignal = result.signals.find(s => s.name === "image_url");
      expect(imgSignal?.points).toBe(0);
    });

    it("awards 5 points for declared endpoints", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const epSignal = result.signals.find(s => s.name === "endpoints_declared");
      expect(epSignal?.points).toBe(5);
    });

    it("awards 5 points for tags or skills", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const tagSignal = result.signals.find(s => s.name === "tags_or_skills");
      expect(tagSignal?.points).toBe(5);
    });

    it("identity total is capped at 25", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      expect(result.identity).toBe(25);
    });
  });

  // ── Dimension: History (max 20) ────────────────────────────────────

  describe("History dimension", () => {
    it("awards 10 age points for agent >= 30 days old", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const ageSignal = result.signals.find(s => s.name === "agent_age");
      expect(ageSignal?.points).toBe(10);
    });

    it("awards 5 update points for >= 2 metadata events", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 3, 0);
      const updateSignal = result.signals.find(s => s.name === "metadata_updates");
      expect(updateSignal?.points).toBe(5);
    });

    it("awards 2 update points for exactly 1 event", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 1, 0);
      const updateSignal = result.signals.find(s => s.name === "metadata_updates");
      expect(updateSignal?.points).toBe(2);
    });

    it("awards 5 cross-chain points for >= 3 chains", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 3);
      const ccSignal = result.signals.find(s => s.name === "cross_chain_presence");
      expect(ccSignal?.points).toBe(5);
    });

    it("awards 3 cross-chain points for 2 chains", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 2);
      const ccSignal = result.signals.find(s => s.name === "cross_chain_presence");
      expect(ccSignal?.points).toBe(3);
    });

    it("awards 0 cross-chain points for 0 or 1 chain", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const ccSignal = result.signals.find(s => s.name === "cross_chain_presence");
      expect(ccSignal?.points).toBe(0);
    });
  });

  // ── Dimension: Capability (max 15) ─────────────────────────────────

  describe("Capability dimension", () => {
    it("awards 5 points for x402 support", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const x402Signal = result.signals.find(s => s.name === "x402_payment");
      expect(x402Signal?.points).toBe(5);
    });

    it("awards 0 for no x402 support", () => {
      const result = calculateTrustScore(CAUTION_AGENT, NO_FEEDBACK, 0, 0);
      const x402Signal = result.signals.find(s => s.name === "x402_payment");
      expect(x402Signal?.points).toBe(0);
    });

    it("awards 5 OASF points for >= 3 skills+domains", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const skillSignal = result.signals.find(s => s.name === "oasf_skills");
      expect(skillSignal?.points).toBe(5);
    });

    it("awards 5 endpoint points for >= 3 endpoints", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const epSignal = result.signals.find(s => s.name === "endpoint_count");
      expect(epSignal?.points).toBe(5);
    });
  });

  // ── Dimension: Community (max 20) ──────────────────────────────────

  describe("Community dimension", () => {
    it("awards full community points with rich feedback", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, TRUSTED_FEEDBACK, 0, 0);
      const ghSignal = result.signals.find(s => s.name === "github_health");
      const fcSignal = result.signals.find(s => s.name === "farcaster_presence");
      const srcSignal = result.signals.find(s => s.name === "community_sources");

      expect(ghSignal?.points).toBe(10); // score 80 >= 70
      expect(fcSignal?.points).toBe(5);  // score 0.7 >= 0.7
      expect(srcSignal?.points).toBe(5); // 3 sources > 0
      expect(result.community).toBe(20);
    });

    it("awards 0 community points with no feedback", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      expect(result.community).toBe(0);
    });
  });

  // ── Dimension: Transparency (max 20) ───────────────────────────────

  describe("Transparency dimension", () => {
    it("awards 8 storage points for IPFS URI", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const storeSignal = result.signals.find(s => s.name === "metadata_storage");
      expect(storeSignal?.points).toBe(8);
    });

    it("awards 5 storage points for HTTPS URI", () => {
      const result = calculateTrustScore(CAUTION_AGENT, NO_FEEDBACK, 0, 0);
      const storeSignal = result.signals.find(s => s.name === "metadata_storage");
      expect(storeSignal?.points).toBe(5);
    });

    it("awards 0 storage points for null URI", () => {
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      const storeSignal = result.signals.find(s => s.name === "metadata_storage");
      expect(storeSignal?.points).toBe(0);
    });

    it("awards 7 trust protocol points for >= 3 protocols", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const trustSignal = result.signals.find(s => s.name === "trust_protocols");
      expect(trustSignal?.points).toBe(7);
    });

    it("awards 5 active status points when active", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, NO_FEEDBACK, 0, 0);
      const activeSignal = result.signals.find(s => s.name === "active_status");
      expect(activeSignal?.points).toBe(5);
    });
  });

  // ── Total Score & Structure ────────────────────────────────────────

  describe("Total score", () => {
    it("totals to sum of all 5 dimensions", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, TRUSTED_FEEDBACK, 5, 4);
      expect(result.total).toBe(
        result.identity + result.history + result.capability +
        result.community + result.transparency
      );
    });

    it("scores only age points for a completely empty agent (old creation date)", () => {
      // UNKNOWN_AGENT has createdAt = 2025-06-01, which is > 30 days old → earns 10 age points
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      expect(result.identity).toBe(0);
      expect(result.history).toBe(10); // age points only
      expect(result.capability).toBe(0);
      expect(result.community).toBe(0);
      expect(result.transparency).toBe(0);
      expect(result.total).toBe(10);
    });

    it("maximizes trusted agent score with all data sources", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, TRUSTED_FEEDBACK, 5, 4);
      // Identity: 25, History: 10+5+5=20, Capability: 5+5+5=15,
      // Community: 10+5+5=20, Transparency: 8+7+5=20
      expect(result.total).toBe(100);
    });
  });

  // ── Opportunities ──────────────────────────────────────────────────

  describe("Opportunities", () => {
    it("lists unearned signals with maxPoints >= 3 as opportunities", () => {
      const result = calculateTrustScore(UNKNOWN_AGENT, NO_FEEDBACK, 0, 0);
      expect(result.opportunities.length).toBeGreaterThan(0);
      // All opportunities should have hints
      for (const opp of result.opportunities) {
        expect(opp.hint).toBeTruthy();
        expect(opp.maxPoints).toBeGreaterThanOrEqual(3);
      }
    });

    it("returns no opportunities for a max-score agent", () => {
      const result = calculateTrustScore(TRUSTED_AGENT, TRUSTED_FEEDBACK, 5, 4);
      expect(result.opportunities.length).toBe(0);
    });
  });
});
