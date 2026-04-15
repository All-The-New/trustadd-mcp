/**
 * Verifications Tests (Methodology v2).
 *
 * Exercises `computeVerifications()` — the 9 binary achievement signals
 * that sit alongside the numeric trust score. Descriptions are asserted
 * verbatim to catch accidental drift between the engine and the UI copy
 * in `client/src/pages/methodology.tsx`.
 */
import { describe, it, expect } from "vitest";
import { computeVerifications } from "../server/trust-verifications.js";
import {
  TRUSTED_AGENT,
  UNKNOWN_AGENT,
  TRUSTED_FEEDBACK,
  NO_FEEDBACK,
  EMPTY_TX_STATS,
  EMPTY_PROBE_STATS,
  LIVE_PROBE_STATS,
  MEDIUM_TX_STATS,
} from "./fixtures/agents.js";

describe("computeVerifications", () => {
  it("always returns exactly 9 verifications", () => {
    const result = computeVerifications({
      agent: UNKNOWN_AGENT,
      txStats: EMPTY_TX_STATS,
      probeStats: EMPTY_PROBE_STATS,
      feedback: NO_FEEDBACK,
      metadataEventCount: 0,
      chainPresence: 0,
    });
    expect(result.length).toBe(9);
  });

  it("every entry has name + earned + description fields", () => {
    const result = computeVerifications({
      agent: TRUSTED_AGENT,
      txStats: MEDIUM_TX_STATS,
      probeStats: LIVE_PROBE_STATS,
      feedback: TRUSTED_FEEDBACK,
      metadataEventCount: 5,
      chainPresence: 3,
    });
    for (const v of result) {
      expect(v).toHaveProperty("name");
      expect(v).toHaveProperty("earned");
      expect(v).toHaveProperty("description");
      expect(typeof v.name).toBe("string");
      expect(typeof v.earned).toBe("boolean");
      expect(typeof v.description).toBe("string");
    }
  });

  // Helper to pluck a verification by name.
  const get = (list: ReturnType<typeof computeVerifications>, name: string) =>
    list.find(v => v.name === name)!;

  describe("Multi-Chain", () => {
    it("earned when chainPresence >= 3", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 3,
      });
      expect(get(result, "Multi-Chain").earned).toBe(true);
    });

    it("NOT earned when chainPresence === 2", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 2,
      });
      expect(get(result, "Multi-Chain").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Multi-Chain").description).toBe("Registered on 3+ chains");
    });
  });

  describe("x402 Enabled", () => {
    it("earned when hasLive402 is true", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: { hasLive402: true, paymentAddressVerified: false },
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "x402 Enabled").earned).toBe(true);
    });

    it("NOT earned when hasLive402 is false even if paymentAddressVerified", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: { hasLive402: false, paymentAddressVerified: true },
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "x402 Enabled").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "x402 Enabled").description).toBe(
        "x402 endpoint detected and responsive",
      );
    });
  });

  describe("GitHub Connected", () => {
    it("earned when githubHealthScore > 0", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: { githubHealthScore: 50, farcasterScore: 0 },
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "GitHub Connected").earned).toBe(true);
    });

    it("NOT earned when githubHealthScore is 0 or null", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: { githubHealthScore: 0, farcasterScore: 0 },
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "GitHub Connected").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "GitHub Connected").description).toBe(
        "Linked GitHub project with health data",
      );
    });
  });

  describe("Farcaster Connected", () => {
    it("earned when farcasterScore > 0", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: { githubHealthScore: 0, farcasterScore: 0.5 },
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Farcaster Connected").earned).toBe(true);
    });

    it("NOT earned when farcasterScore is 0 or null", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: { githubHealthScore: 100, farcasterScore: null },
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Farcaster Connected").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Farcaster Connected").description).toBe(
        "Farcaster social presence detected",
      );
    });
  });

  describe("IPFS Metadata", () => {
    it("earned for ipfs:// URI (TRUSTED_AGENT)", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "IPFS Metadata").earned).toBe(true);
    });

    it("earned for ar:// URI", () => {
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, metadataUri: "ar://someHash" },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "IPFS Metadata").earned).toBe(true);
    });

    it("NOT earned for https:// URI", () => {
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, metadataUri: "https://example.com/meta.json" },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "IPFS Metadata").earned).toBe(false);
    });

    it("NOT earned for null URI", () => {
      const result = computeVerifications({
        agent: UNKNOWN_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "IPFS Metadata").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "IPFS Metadata").description).toBe("Metadata on IPFS or Arweave");
    });
  });

  describe("OASF Skills", () => {
    it("earned when oasfSkills or oasfDomains present (TRUSTED_AGENT)", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "OASF Skills").earned).toBe(true);
    });

    it("earned when only skills present (no domains)", () => {
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, oasfSkills: ["x"], oasfDomains: null },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "OASF Skills").earned).toBe(true);
    });

    it("NOT earned when both are null", () => {
      const result = computeVerifications({
        agent: UNKNOWN_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "OASF Skills").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "OASF Skills").description).toBe("Declared OASF skills/capabilities");
    });
  });

  describe("Early Adopter", () => {
    it("earned when createdAt < 2026-06-01 (TRUSTED_AGENT is 2024-01-01)", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Early Adopter").earned).toBe(true);
    });

    it("NOT earned when createdAt >= 2026-06-01", () => {
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, createdAt: new Date("2026-07-01T00:00:00Z") },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Early Adopter").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Early Adopter").description).toBe("Registered before June 2026");
    });
  });

  describe("Active Maintainer", () => {
    it("requires BOTH metadataEventCount >= 3 AND ageDays >= 90", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT, // created 2024-01-01 → very old
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 3,
        chainPresence: 0,
      });
      expect(get(result, "Active Maintainer").earned).toBe(true);
    });

    it("NOT earned with 3 events but age < 90 days", () => {
      const young = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, createdAt: young },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 3,
        chainPresence: 0,
      });
      expect(get(result, "Active Maintainer").earned).toBe(false);
    });

    it("NOT earned with 5 events but age < 90 days", () => {
      const young = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const result = computeVerifications({
        agent: { ...TRUSTED_AGENT, createdAt: young },
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 5,
        chainPresence: 0,
      });
      expect(get(result, "Active Maintainer").earned).toBe(false);
    });

    it("NOT earned with age >= 90 days but < 3 events", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 2,
        chainPresence: 0,
      });
      expect(get(result, "Active Maintainer").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "Active Maintainer").description).toBe(
        "Regular updates over 90+ days",
      );
    });
  });

  describe("First Transaction", () => {
    it("earned when txCount >= 1", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: { volumeUsd: 10, txCount: 1, uniquePayers: 1, firstTxAt: new Date() },
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "First Transaction").earned).toBe(true);
    });

    it("NOT earned when txCount === 0", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "First Transaction").earned).toBe(false);
    });

    it("description matches spec", () => {
      const result = computeVerifications({
        agent: TRUSTED_AGENT,
        txStats: EMPTY_TX_STATS,
        probeStats: EMPTY_PROBE_STATS,
        feedback: NO_FEEDBACK,
        metadataEventCount: 0,
        chainPresence: 0,
      });
      expect(get(result, "First Transaction").description).toBe(
        "At least one verified payment received",
      );
    });
  });
});
