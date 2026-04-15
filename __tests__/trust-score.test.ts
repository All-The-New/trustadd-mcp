/**
 * Trust Score Calculation Tests (Methodology v2).
 *
 * Tests the pure `calculateTrustScore()` function with known agent profiles.
 * No database required — all inputs are fixtures.
 */
import { describe, it, expect } from "vitest";
import {
  calculateTrustScore,
  type TrustScoreBreakdown,
  type TrustScoreInput,
} from "../server/trust-score.js";
import {
  TRUSTED_AGENT,
  UNKNOWN_AGENT,
  TRUSTED_FEEDBACK,
  NO_FEEDBACK,
  EMPTY_TX_STATS,
  EMPTY_ATTESTATION_STATS,
  EMPTY_PROBE_STATS,
  RICH_TX_STATS,
  MEDIUM_TX_STATS,
  RICH_ATTESTATION_STATS,
  MEDIUM_ATTESTATION_STATS,
  LIVE_PROBE_STATS,
} from "./fixtures/agents.js";

/** Helper to reduce boilerplate when building TrustScoreInput. */
function score(overrides: Partial<TrustScoreInput> = {}): TrustScoreBreakdown {
  return calculateTrustScore({
    agent: TRUSTED_AGENT,
    txStats: EMPTY_TX_STATS,
    attestationStats: EMPTY_ATTESTATION_STATS,
    probeStats: EMPTY_PROBE_STATS,
    feedback: NO_FEEDBACK,
    metadataEventCount: 0,
    chainPresence: 0,
    ...overrides,
  });
}

describe("calculateTrustScore", () => {
  // ── Transactions category (max 35) ───────────────────────────────────

  describe("Transactions category (max 35)", () => {
    it("awards 0 volume points when volumeUsd=0 and txCount=0 (gate)", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(0);
      expect(sig?.earned).toBe(false);
    });

    it("awards +5 for volumeUsd=50 with txCount=1", () => {
      const result = score({
        txStats: { volumeUsd: 50, txCount: 1, uniquePayers: 1, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(5);
    });

    it("awards +10 for volumeUsd=250 with txCount=5", () => {
      const result = score({
        txStats: { volumeUsd: 250, txCount: 5, uniquePayers: 2, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(10);
    });

    it("awards +15 for volumeUsd=2000 with txCount=20", () => {
      const result = score({
        txStats: { volumeUsd: 2000, txCount: 20, uniquePayers: 8, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(15);
    });

    it("Transaction count: 0 txs → 0 pts", () => {
      const result = score({ txStats: EMPTY_TX_STATS });
      const sig = result.signals.find(s => s.name === "Transaction count");
      expect(sig?.points).toBe(0);
    });

    it("Transaction count: 5 txs → +3 pts", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 5, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "Transaction count");
      expect(sig?.points).toBe(3);
    });

    it("Transaction count: 20 txs → +5 pts", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 20, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "Transaction count");
      expect(sig?.points).toBe(5);
    });

    it("Transaction count: 50 txs → +8 pts", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 50, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "Transaction count");
      expect(sig?.points).toBe(8);
    });

    it("Payer diversity: 0 payers → 0 pts", () => {
      const result = score({ txStats: EMPTY_TX_STATS });
      const sig = result.signals.find(s => s.name === "Payer diversity");
      expect(sig?.points).toBe(0);
    });

    it("Payer diversity: 3 payers → +3 pts", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 3, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "Payer diversity");
      expect(sig?.points).toBe(3);
    });

    it("Payer diversity: 10 payers → +5 pts", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 10, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "Payer diversity");
      expect(sig?.points).toBe(5);
    });

    it("x402 endpoint live: +5 when probeStats.hasLive402", () => {
      const result = score({ probeStats: LIVE_PROBE_STATS });
      const sig = result.signals.find(s => s.name === "x402 endpoint live");
      expect(sig?.points).toBe(5);
      expect(sig?.earned).toBe(true);
    });

    it("x402 endpoint live: 0 when no probes", () => {
      const result = score({ probeStats: EMPTY_PROBE_STATS });
      const sig = result.signals.find(s => s.name === "x402 endpoint live");
      expect(sig?.points).toBe(0);
      expect(sig?.earned).toBe(false);
    });

    it("Payment address verified: +2 when paymentAddressVerified", () => {
      const result = score({ probeStats: LIVE_PROBE_STATS });
      const sig = result.signals.find(s => s.name === "Payment address verified");
      expect(sig?.points).toBe(2);
    });

    it("Payment address verified: 0 when not", () => {
      const result = score({ probeStats: EMPTY_PROBE_STATS });
      const sig = result.signals.find(s => s.name === "Payment address verified");
      expect(sig?.points).toBe(0);
    });

    it("maxes transactions category at 35 with rich-tx agent + live probes", () => {
      const result = score({ txStats: RICH_TX_STATS, probeStats: LIVE_PROBE_STATS });
      expect(result.categories.transactions).toBe(35);
    });
  });

  // ── Reputation category (max 25) ─────────────────────────────────────

  describe("Reputation category (max 25)", () => {
    it("Attestations received: 0 → 0 pts", () => {
      const result = score({ attestationStats: EMPTY_ATTESTATION_STATS });
      const sig = result.signals.find(s => s.name === "Attestations received");
      expect(sig?.points).toBe(0);
    });

    it("Attestations received: 1 → +3 pts", () => {
      const result = score({
        attestationStats: { received: 1, uniqueAttestors: 1 },
      });
      const sig = result.signals.find(s => s.name === "Attestations received");
      expect(sig?.points).toBe(3);
    });

    it("Attestations received: 5 → +7 pts", () => {
      const result = score({
        attestationStats: { received: 5, uniqueAttestors: 1 },
      });
      const sig = result.signals.find(s => s.name === "Attestations received");
      expect(sig?.points).toBe(7);
    });

    it("Attestations received: 10 → +12 pts", () => {
      const result = score({
        attestationStats: { received: 10, uniqueAttestors: 1 },
      });
      const sig = result.signals.find(s => s.name === "Attestations received");
      expect(sig?.points).toBe(12);
    });

    it("Attestations received: 25 → +18 pts", () => {
      const result = score({
        attestationStats: { received: 25, uniqueAttestors: 1 },
      });
      const sig = result.signals.find(s => s.name === "Attestations received");
      expect(sig?.points).toBe(18);
    });

    it("Attestor diversity: 0 → 0 pts", () => {
      const result = score({ attestationStats: EMPTY_ATTESTATION_STATS });
      const sig = result.signals.find(s => s.name === "Attestor diversity");
      expect(sig?.points).toBe(0);
    });

    it("Attestor diversity: 3 → +3 pts", () => {
      const result = score({
        attestationStats: { received: 3, uniqueAttestors: 3 },
      });
      const sig = result.signals.find(s => s.name === "Attestor diversity");
      expect(sig?.points).toBe(3);
    });

    it("Attestor diversity: 10 → +7 pts", () => {
      const result = score({
        attestationStats: { received: 10, uniqueAttestors: 10 },
      });
      const sig = result.signals.find(s => s.name === "Attestor diversity");
      expect(sig?.points).toBe(7);
    });

    it("maxes reputation category at 25 with RICH_ATTESTATION_STATS", () => {
      const result = score({ attestationStats: RICH_ATTESTATION_STATS });
      expect(result.categories.reputation).toBe(25);
    });
  });

  // ── Profile category (max 15) ────────────────────────────────────────

  describe("Profile category (max 15)", () => {
    it("Profile image: +5 for TRUSTED_AGENT's valid image URL", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Profile image");
      expect(sig?.points).toBe(5);
      expect(sig?.earned).toBe(true);
    });

    it("Profile image: 0 for UNKNOWN_AGENT (null imageUrl)", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Profile image");
      expect(sig?.points).toBe(0);
    });

    it("Description quality: +2 for 100+ chars (TRUSTED_AGENT)", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Description quality");
      expect(sig?.points).toBe(2);
    });

    it("Description quality: 0 for null description", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Description quality");
      expect(sig?.points).toBe(0);
    });

    it("Name: +2 when non-empty", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Name");
      expect(sig?.points).toBe(2);
    });

    it("Name: 0 when null", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Name");
      expect(sig?.points).toBe(0);
    });

    it("Endpoints: +2 when >=1 declared", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Endpoints");
      expect(sig?.points).toBe(2);
    });

    it("Endpoints: 0 when null", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Endpoints");
      expect(sig?.points).toBe(0);
    });

    it("Skills / Tags: +1 when tags present", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Skills / Tags");
      expect(sig?.points).toBe(1);
    });

    it("Metadata storage: +2 for ipfs:// (TRUSTED_AGENT)", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Metadata storage");
      expect(sig?.points).toBe(2);
      expect(sig?.detail).toBe("ipfs");
    });

    it("Metadata storage: 0 for null URI", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Metadata storage");
      expect(sig?.points).toBe(0);
    });

    it("Active status: +1 when activeStatus true", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Active status");
      expect(sig?.points).toBe(1);
    });

    it("Active status: 0 when false", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      const sig = result.signals.find(s => s.name === "Active status");
      expect(sig?.points).toBe(0);
    });

    it("TRUSTED_AGENT hits full 15 profile points", () => {
      const result = score();
      expect(result.categories.profile).toBe(15);
    });
  });

  // ── Longevity category (max 15) ──────────────────────────────────────

  describe("Longevity category (max 15)", () => {
    it("Registration age: TRUSTED_AGENT (2024-01-01) is > 90 days → +4", () => {
      const result = score();
      const sig = result.signals.find(s => s.name === "Registration age");
      expect(sig?.points).toBe(4);
    });

    it("Metadata maintenance: 1 update → +1", () => {
      const result = score({ metadataEventCount: 1 });
      const sig = result.signals.find(s => s.name === "Metadata maintenance");
      expect(sig?.points).toBe(1);
    });

    it("Metadata maintenance: 3 updates → +3", () => {
      const result = score({ metadataEventCount: 3 });
      const sig = result.signals.find(s => s.name === "Metadata maintenance");
      expect(sig?.points).toBe(3);
    });

    it("Cross-chain: 2 chains → +2", () => {
      const result = score({ chainPresence: 2 });
      const sig = result.signals.find(s => s.name === "Cross-chain presence");
      expect(sig?.points).toBe(2);
    });

    it("Cross-chain: 3 chains → +3", () => {
      const result = score({ chainPresence: 3 });
      const sig = result.signals.find(s => s.name === "Cross-chain presence");
      expect(sig?.points).toBe(3);
    });

    it("Time since first transaction: 0 tx → 0 pts regardless of firstTxAt", () => {
      const result = score({
        txStats: {
          volumeUsd: 0,
          txCount: 0,
          uniquePayers: 0,
          // Old firstTxAt, but txCount is zero → no points
          firstTxAt: new Date("2024-01-01T00:00:00Z"),
        },
      });
      const sig = result.signals.find(s => s.name === "Time since first transaction");
      expect(sig?.points).toBe(0);
    });

    it("Time since first transaction: tx today → +2 (entry tier)", () => {
      const result = score({
        txStats: { volumeUsd: 1, txCount: 1, uniquePayers: 1, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "Time since first transaction");
      expect(sig?.points).toBe(2);
    });

    it("Time since first transaction: 30 days old → +3", () => {
      const result = score({
        txStats: {
          volumeUsd: 1,
          txCount: 1,
          uniquePayers: 1,
          firstTxAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
      });
      const sig = result.signals.find(s => s.name === "Time since first transaction");
      expect(sig?.points).toBe(3);
    });

    it("Time since first transaction: 90 days old → +5", () => {
      const result = score({
        txStats: {
          volumeUsd: 1,
          txCount: 1,
          uniquePayers: 1,
          firstTxAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        },
      });
      const sig = result.signals.find(s => s.name === "Time since first transaction");
      expect(sig?.points).toBe(5);
    });
  });

  // ── Community category (max 10) ──────────────────────────────────────

  describe("Community category (max 10)", () => {
    it("GitHub health: 0 → 0 pts", () => {
      const result = score({ feedback: NO_FEEDBACK });
      const sig = result.signals.find(s => s.name === "GitHub health");
      expect(sig?.points).toBe(0);
    });

    it("GitHub health: score 20 (1-39 range) → +1 pt", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 20, farcasterScore: 0, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "GitHub health");
      expect(sig?.points).toBe(1);
    });

    it("GitHub health: score 50 (40-69 range) → +3 pts", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 50, farcasterScore: 0, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "GitHub health");
      expect(sig?.points).toBe(3);
    });

    it("GitHub health: score 80 (70+) → +5 pts", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 80, farcasterScore: 0, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "GitHub health");
      expect(sig?.points).toBe(5);
    });

    it("Farcaster: 0 → 0 pts", () => {
      const result = score({ feedback: NO_FEEDBACK });
      const sig = result.signals.find(s => s.name === "Farcaster engagement");
      expect(sig?.points).toBe(0);
    });

    it("Farcaster: 0.1 → +1 pt (any presence)", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 0, farcasterScore: 0.1, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "Farcaster engagement");
      expect(sig?.points).toBe(1);
    });

    it("Farcaster: 0.5 (>=0.4) → +2 pts", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 0, farcasterScore: 0.5, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "Farcaster engagement");
      expect(sig?.points).toBe(2);
    });

    it("Farcaster: 0.7 (>=0.7) → +3 pts", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 0, farcasterScore: 0.7, totalSources: 0 },
      });
      const sig = result.signals.find(s => s.name === "Farcaster engagement");
      expect(sig?.points).toBe(3);
    });

    it("Community sources: totalSources>0 → +2 pts", () => {
      const result = score({
        feedback: { ...TRUSTED_FEEDBACK!, githubHealthScore: 0, farcasterScore: 0, totalSources: 2 },
      });
      const sig = result.signals.find(s => s.name === "Community sources");
      expect(sig?.points).toBe(2);
    });

    it("TRUSTED_FEEDBACK maxes community at 10 (5 github + 3 farcaster + 2 sources)", () => {
      const result = score({ feedback: TRUSTED_FEEDBACK });
      expect(result.categories.community).toBe(10);
    });
  });

  // ── Total + breakdown structure ─────────────────────────────────────

  describe("Total + breakdown structure", () => {
    it("returns categories object with all 5 keys", () => {
      const result = score();
      expect(result.categories).toHaveProperty("transactions");
      expect(result.categories).toHaveProperty("reputation");
      expect(result.categories).toHaveProperty("profile");
      expect(result.categories).toHaveProperty("longevity");
      expect(result.categories).toHaveProperty("community");
    });

    it("total equals sum of 5 categories", () => {
      const result = score({
        txStats: MEDIUM_TX_STATS,
        attestationStats: MEDIUM_ATTESTATION_STATS,
        feedback: TRUSTED_FEEDBACK,
        metadataEventCount: 2,
        chainPresence: 2,
      });
      const sum =
        result.categories.transactions +
        result.categories.reputation +
        result.categories.profile +
        result.categories.longevity +
        result.categories.community;
      expect(result.total).toBe(sum);
    });

    it("signals array has exactly 21 entries", () => {
      const result = score();
      expect(result.signals.length).toBe(21);
    });

    it("every signal has a `category` field (not `dimension`)", () => {
      const result = score();
      for (const sig of result.signals) {
        expect(sig).toHaveProperty("category");
        expect(sig).not.toHaveProperty("dimension");
        expect(["transactions", "reputation", "profile", "longevity", "community"])
          .toContain(sig.category);
      }
    });

    it("max-data agent (TRUSTED_AGENT + RICH_TX + RICH_ATT + LIVE_PROBE + TRUSTED_FEEDBACK + 3 events + 3 chains) totals 100", () => {
      const result = score({
        txStats: RICH_TX_STATS,
        attestationStats: RICH_ATTESTATION_STATS,
        probeStats: LIVE_PROBE_STATS,
        feedback: TRUSTED_FEEDBACK,
        metadataEventCount: 3,
        chainPresence: 3,
      });
      // Transactions 35 + Reputation 25 + Profile 15 + Longevity 15 + Community 10 = 100
      expect(result.total).toBe(100);
    });

    it("empty UNKNOWN_AGENT totals only longevity age floor (+4 for >90 day age)", () => {
      // UNKNOWN_AGENT.createdAt is 2025-06-01, today 2026-04-14, > 90 days → +4 age
      const result = score({ agent: UNKNOWN_AGENT });
      expect(result.categories.transactions).toBe(0);
      expect(result.categories.reputation).toBe(0);
      expect(result.categories.profile).toBe(0);
      // Longevity has only registration age; no txs, no maintenance, no chains
      expect(result.categories.longevity).toBe(4);
      expect(result.categories.community).toBe(0);
      expect(result.total).toBe(4);
    });
  });

  // ── Opportunities ───────────────────────────────────────────────────

  describe("Opportunities", () => {
    it("lists unearned signals with maxPoints >= 3 as opportunities", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      expect(result.opportunities.length).toBeGreaterThan(0);
      for (const opp of result.opportunities) {
        expect(opp.maxPoints).toBeGreaterThanOrEqual(3);
      }
    });

    it("each opportunity has signal / category / maxPoints / hint fields", () => {
      const result = score({ agent: UNKNOWN_AGENT });
      for (const opp of result.opportunities) {
        expect(opp).toHaveProperty("signal");
        expect(opp).toHaveProperty("category");
        expect(opp).toHaveProperty("maxPoints");
        expect(opp).toHaveProperty("hint");
        expect(typeof opp.hint).toBe("string");
        expect(opp.hint.length).toBeGreaterThan(0);
      }
    });

    it("returns no opportunities when every high-value signal is earned", () => {
      const result = score({
        txStats: RICH_TX_STATS,
        attestationStats: RICH_ATTESTATION_STATS,
        probeStats: LIVE_PROBE_STATS,
        feedback: TRUSTED_FEEDBACK,
        metadataEventCount: 3,
        chainPresence: 3,
      });
      expect(result.opportunities.length).toBe(0);
    });
  });

  // ── Critical v2 gating test: x402 payment volume ────────────────────

  describe("Critical v2 gating: x402 payment volume requires txCount > 0 && volumeUsd > 0", () => {
    it("awards 0 when both are 0", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(0);
    });

    it("awards 0 when volumeUsd>0 but txCount=0 (gate requires both)", () => {
      const result = score({
        txStats: { volumeUsd: 100, txCount: 0, uniquePayers: 0, firstTxAt: null },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(0);
    });

    it("awards 0 when txCount>0 but volumeUsd=0", () => {
      const result = score({
        txStats: { volumeUsd: 0, txCount: 5, uniquePayers: 1, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(0);
    });

    it("awards +5 for volumeUsd=50, txCount=1 (both positive)", () => {
      const result = score({
        txStats: { volumeUsd: 50, txCount: 1, uniquePayers: 1, firstTxAt: new Date() },
      });
      const sig = result.signals.find(s => s.name === "x402 payment volume");
      expect(sig?.points).toBe(5);
    });
  });
});
