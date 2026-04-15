/**
 * Trust-score pipeline — DB-reading orchestration layer.
 *
 * This module contains the batch/single-agent recalculation functions that
 * read raw inputs from the database, call the pure `calculateTrustScore`
 * engine in `./trust-score.js`, apply sybil dampening, and persist results.
 *
 * Keep this file separate from the pure scoring engine so that:
 *  - Unit tests can import `calculateTrustScore` without a DB connection.
 *  - The Trigger.dev container init step does not pull DB concerns via
 *    static imports of `trust-score.ts`.
 */

import {
  type Agent,
  type CommunityFeedbackSummary,
  agents,
  communityFeedbackSummaries,
} from "../shared/schema.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { eq, isNull, sql } from "drizzle-orm";
import { log } from "./lib/log.js";
import { computeSignalHash, METHODOLOGY_VERSION } from "./trust-provenance.js";
import { computeConfidence, type ConfidenceInput } from "./trust-confidence.js";
import {
  calculateTrustScore,
  type AttestationStats,
  type ProbeStats,
  type TrustScoreBreakdown,
  type TrustScoreInput,
  type TxStats,
} from "./trust-score.js";
import type { SybilLookups, SybilSignal } from "./sybil-detection.js";

// ─── Empty fallbacks ─────────────────────────────────────────────────────────

const EMPTY_TX_STATS: TxStats = {
  volumeUsd: 0,
  txCount: 0,
  uniquePayers: 0,
  firstTxAt: null,
};

const EMPTY_ATTESTATION_STATS: AttestationStats = {
  received: 0,
  uniqueAttestors: 0,
};

const EMPTY_PROBE_STATS: ProbeStats = {
  hasLive402: false,
  paymentAddressVerified: false,
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Build a `ConfidenceInput` from the raw agent-plus-stats bundle. Centralized
 * so both the single-agent and batch paths compute confidence identically.
 */
export function buildConfidenceInput(
  agent: Agent,
  txStats: TxStats,
  probeStats: ProbeStats,
  attestationStats: AttestationStats,
  feedback: CommunityFeedbackSummary | null | undefined,
): ConfidenceInput {
  return {
    hasIdentity: !!(agent.name && agent.name.trim().length > 0),
    hasProbes: probeStats.hasLive402 || probeStats.paymentAddressVerified,
    hasTransactions: txStats.txCount > 0,
    hasAttestations: attestationStats.received > 0,
    hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
    hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
  };
}

/**
 * Apply sybil detection + dampening to a raw score breakdown. Returns the
 * dampened breakdown and the raw sybil analysis outputs that need to be
 * persisted alongside the score.
 */
function applySybilDampening(
  breakdown: TrustScoreBreakdown,
  agent: Agent,
  sybilLookups: SybilLookups,
  analyze: (
    agentId: string,
    controller: string,
    fingerprint: string | null,
    lookups: SybilLookups,
  ) => { signals: SybilSignal[]; riskScore: number; dampeningMultiplier: number },
): {
  breakdown: TrustScoreBreakdown;
  sybilSignals: SybilSignal[] | null;
  sybilRiskScore: number;
} {
  const sybil = analyze(
    agent.id,
    agent.controllerAddress,
    agent.metadataFingerprint,
    sybilLookups,
  );
  const dampenedTotal = Math.round(breakdown.total * sybil.dampeningMultiplier);
  return {
    breakdown: { ...breakdown, total: dampenedTotal },
    sybilSignals: sybil.signals.length > 0 ? sybil.signals : null,
    sybilRiskScore: sybil.riskScore,
  };
}

// ─── Prefetch lookups (batch path) ────────────────────────────────────────────

/**
 * Pre-fetch all lookup maps needed for trust score calculation.
 * Returns maps keyed by agent.id (or controller address for chainPresence).
 */
async function prefetchScoreLookups() {
  const feedbackMap = new Map<string, CommunityFeedbackSummary>();
  try {
    const summaries = await db.select().from(communityFeedbackSummaries);
    for (const s of summaries) {
      feedbackMap.set(s.agentId, s);
    }
  } catch {}

  const controllerChains = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT controller_address, COUNT(DISTINCT chain_id)::int as cnt
      FROM agents
      GROUP BY controller_address
      HAVING COUNT(DISTINCT chain_id) > 1
    `);
    for (const row of (result as any).rows ?? []) {
      controllerChains.set(row.controller_address, row.cnt);
    }
  } catch {}

  const eventCounts = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT agent_id, COUNT(*)::int as cnt FROM agent_metadata_events
      WHERE event_type IN ('MetadataUpdated', 'AgentURISet')
      GROUP BY agent_id
    `);
    for (const row of (result as any).rows ?? []) {
      eventCounts.set(row.agent_id, row.cnt);
    }
  } catch {}

  // Tx stats
  const txStatsMap = new Map<string, TxStats>();
  try {
    const result = await db.execute(sql`
      SELECT agent_id,
             COUNT(*)::int AS tx_count,
             COALESCE(SUM(amount_usd), 0)::float AS volume_usd,
             COUNT(DISTINCT from_address)::int AS unique_payers,
             MIN(block_timestamp) AS first_tx_at
      FROM agent_transactions
      GROUP BY agent_id
    `);
    for (const row of (result as any).rows ?? []) {
      txStatsMap.set(row.agent_id, {
        volumeUsd: Number(row.volume_usd ?? 0),
        txCount: Number(row.tx_count ?? 0),
        uniquePayers: Number(row.unique_payers ?? 0),
        firstTxAt: row.first_tx_at ? new Date(row.first_tx_at) : null,
      });
    }
  } catch {}

  // Probe stats
  const probeStatsMap = new Map<string, ProbeStats>();
  try {
    const result = await db.execute(sql`
      SELECT agent_id,
             BOOL_OR(probe_status = 'success' AND http_status = 402) AS has_live_402,
             BOOL_OR(probe_status = 'success' AND payment_address IS NOT NULL) AS has_payment_addr
      FROM x402_probes
      GROUP BY agent_id
    `);
    for (const row of (result as any).rows ?? []) {
      probeStatsMap.set(row.agent_id, {
        hasLive402: Boolean(row.has_live_402),
        paymentAddressVerified: Boolean(row.has_payment_addr),
      });
    }
  } catch {}

  // Attestation stats — TODO(v3): no attestation table exists yet. Return
  // empty map; lookup fallback below yields { received: 0, uniqueAttestors: 0 }.
  const attestationStatsMap = new Map<string, AttestationStats>();

  return {
    feedbackMap,
    controllerChains,
    eventCounts,
    txStatsMap,
    probeStatsMap,
    attestationStatsMap,
  };
}

// ─── Batch persistence ───────────────────────────────────────────────────────

/**
 * Batch-update trust scores (no sybil) for a set of agents in a single SQL.
 * Used by the incremental `ensureScoresCalculated` path; sybil dampening is
 * applied only in the full-recalc batch path.
 */
async function batchUpdateScores(
  updates: Array<{
    id: string;
    score: number;
    breakdown: TrustScoreBreakdown;
    signalHash: string;
    confidenceScore: number;
    confidenceLevel: string;
  }>,
) {
  if (updates.length === 0) return;
  const now = new Date();
  const ids = updates.map((u) => u.id);
  const scores = updates.map((u) => u.score);
  const breakdowns = updates.map((u) => JSON.stringify(u.breakdown));
  const hashes = updates.map((u) => u.signalHash);
  const confScores = updates.map((u) => u.confidenceScore);
  const confLevels = updates.map((u) => u.confidenceLevel);

  await db.execute(sql`
    UPDATE agents SET
      trust_score = batch.score,
      trust_score_breakdown = batch.breakdown::jsonb,
      trust_score_updated_at = ${now},
      trust_signal_hash = batch.hash,
      trust_methodology_version = ${METHODOLOGY_VERSION},
      confidence_score = batch.conf_score,
      confidence_level = batch.conf_level
    FROM (
      SELECT unnest(${ids}::text[]) AS id,
             unnest(${scores}::int[]) AS score,
             unnest(${breakdowns}::text[]) AS breakdown,
             unnest(${hashes}::text[]) AS hash,
             unnest(${confScores}::real[]) AS conf_score,
             unnest(${confLevels}::text[]) AS conf_level
    ) AS batch
    WHERE agents.id = batch.id
  `);
}

async function batchUpdateScoresWithSybil(
  updates: Array<{
    id: string;
    score: number;
    breakdown: TrustScoreBreakdown;
    signalHash: string;
    confidenceScore: number;
    confidenceLevel: string;
    sybilSignals: any;
    sybilRiskScore: number;
  }>,
) {
  if (updates.length === 0) return;
  const now = new Date();

  // Use json_to_recordset to avoid pg array serialization issues with nullable columns.
  const data = JSON.stringify(
    updates.map((u) => ({
      id: u.id,
      score: u.score,
      breakdown: JSON.stringify(u.breakdown),
      hash: u.signalHash,
      conf_score: u.confidenceScore,
      conf_level: u.confidenceLevel,
      sybil_sig: u.sybilSignals != null ? JSON.stringify(u.sybilSignals) : null,
      sybil_risk: u.sybilRiskScore,
    })),
  );

  await db.execute(sql`
    UPDATE agents SET
      trust_score = batch.score,
      trust_score_breakdown = batch.breakdown::jsonb,
      trust_score_updated_at = ${now},
      trust_signal_hash = batch.hash,
      trust_methodology_version = ${METHODOLOGY_VERSION},
      confidence_score = batch.conf_score,
      confidence_level = batch.conf_level,
      sybil_signals = batch.sybil_sig::jsonb,
      sybil_risk_score = batch.sybil_risk
    FROM json_to_recordset(${data}::json) AS batch(
      id text, score int, breakdown text, hash text,
      conf_score real, conf_level text,
      sybil_sig text, sybil_risk real
    )
    WHERE agents.id = batch.id
  `);
}

// ─── Single-agent recalc ─────────────────────────────────────────────────────

/** One-shot recalc for a single agent. Applies sybil dampening. */
export async function recalculateScore(
  agentId: string,
): Promise<TrustScoreBreakdown | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  const events = await storage.getAgentEvents(agentId);
  const eventCount = events.filter(
    (e) => e.eventType === "MetadataUpdated" || e.eventType === "AgentURISet",
  ).length;

  let crossChainCount = 0;
  try {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT chain_id)::int as cnt FROM agents
      WHERE controller_address = ${agent.controllerAddress}
    `);
    crossChainCount = Number((result as any).rows?.[0]?.cnt ?? 0);
  } catch {}

  let feedback: CommunityFeedbackSummary | null = null;
  try {
    feedback = (await storage.getCommunityFeedbackSummary(agentId)) ?? null;
  } catch {}

  // Per-agent tx stats
  let txStats: TxStats = { ...EMPTY_TX_STATS };
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS tx_count,
             COALESCE(SUM(amount_usd), 0)::float AS volume_usd,
             COUNT(DISTINCT from_address)::int AS unique_payers,
             MIN(block_timestamp) AS first_tx_at
      FROM agent_transactions
      WHERE agent_id = ${agentId}
    `);
    const row = (result as any).rows?.[0];
    if (row) {
      txStats = {
        volumeUsd: Number(row.volume_usd ?? 0),
        txCount: Number(row.tx_count ?? 0),
        uniquePayers: Number(row.unique_payers ?? 0),
        firstTxAt: row.first_tx_at ? new Date(row.first_tx_at) : null,
      };
    }
  } catch {}

  // Per-agent probe stats
  let probeStats: ProbeStats = { ...EMPTY_PROBE_STATS };
  try {
    const result = await db.execute(sql`
      SELECT BOOL_OR(probe_status = 'success' AND http_status = 402) AS has_live_402,
             BOOL_OR(probe_status = 'success' AND payment_address IS NOT NULL) AS has_payment_addr
      FROM x402_probes
      WHERE agent_id = ${agentId}
    `);
    const row = (result as any).rows?.[0];
    if (row) {
      probeStats = {
        hasLive402: Boolean(row.has_live_402),
        paymentAddressVerified: Boolean(row.has_payment_addr),
      };
    }
  } catch {}

  // Attestation stats — see TODO(v3) above
  const attestationStats: AttestationStats = { ...EMPTY_ATTESTATION_STATS };

  const input: TrustScoreInput = {
    agent,
    txStats,
    attestationStats,
    probeStats,
    feedback,
    metadataEventCount: eventCount,
    chainPresence: crossChainCount,
  };

  const rawBreakdown = calculateTrustScore(input);
  const signalHash = computeSignalHash(input);
  const confidence = computeConfidence(
    buildConfidenceInput(agent, txStats, probeStats, attestationStats, feedback),
  );

  // Apply sybil dampening (align with the batch path).
  let breakdown = rawBreakdown;
  let sybilSignals: SybilSignal[] | null = null;
  let sybilRiskScore = 0;
  try {
    const { analyzeSybilSignals, prefetchSybilLookups } = await import(
      "./sybil-detection.js"
    );
    const sybilLookups = await prefetchSybilLookups(db);
    const dampened = applySybilDampening(
      rawBreakdown,
      agent,
      sybilLookups,
      analyzeSybilSignals,
    );
    breakdown = dampened.breakdown;
    sybilSignals = dampened.sybilSignals;
    sybilRiskScore = dampened.sybilRiskScore;
  } catch (err) {
    log(
      `Sybil dampening failed for ${agentId}: ${(err as Error).message}`,
      "trust-score",
    );
  }

  await db
    .update(agents)
    .set({
      trustScore: breakdown.total,
      trustScoreBreakdown: breakdown,
      trustScoreUpdatedAt: new Date(),
      trustSignalHash: signalHash,
      trustMethodologyVersion: METHODOLOGY_VERSION,
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
      sybilSignals: sybilSignals as any,
      sybilRiskScore,
    })
    .where(eq(agents.id, agentId));

  return breakdown;
}

// ─── Full recalculation ──────────────────────────────────────────────────────

export async function recalculateAllScores(): Promise<{
  updated: number;
  elapsed: number;
}> {
  const start = Date.now();
  log("Starting batch trust score recalculation...", "trust-score");

  const allAgents = await storage.getAllAgents();
  const {
    feedbackMap,
    controllerChains,
    eventCounts,
    txStatsMap,
    probeStatsMap,
    attestationStatsMap,
  } = await prefetchScoreLookups();
  const { analyzeSybilSignals, prefetchSybilLookups } = await import(
    "./sybil-detection.js"
  );
  const sybilLookups = await prefetchSybilLookups(db);
  log(
    `Sybil lookups: ${sybilLookups.controllerAgentCounts.size} flagged controllers, ${sybilLookups.fingerprintControllers.size} fingerprint clusters`,
    "trust-score",
  );

  let updated = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
    const batch = allAgents.slice(i, i + BATCH_SIZE);
    const updates: Array<{
      id: string;
      score: number;
      breakdown: TrustScoreBreakdown;
      signalHash: string;
      confidenceScore: number;
      confidenceLevel: string;
      sybilSignals: any;
      sybilRiskScore: number;
    }> = [];

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
      const txStats = txStatsMap.get(agent.id) ?? { ...EMPTY_TX_STATS };
      const probeStats = probeStatsMap.get(agent.id) ?? { ...EMPTY_PROBE_STATS };
      const attestationStats =
        attestationStatsMap.get(agent.id) ?? { ...EMPTY_ATTESTATION_STATS };

      const input: TrustScoreInput = {
        agent,
        txStats,
        attestationStats,
        probeStats,
        feedback,
        metadataEventCount: evtCount,
        chainPresence: crossChain,
      };

      const rawBreakdown = calculateTrustScore(input);
      const signalHash = computeSignalHash(input);
      const confidence = computeConfidence(
        buildConfidenceInput(agent, txStats, probeStats, attestationStats, feedback),
      );
      const dampened = applySybilDampening(
        rawBreakdown,
        agent,
        sybilLookups,
        analyzeSybilSignals,
      );
      updates.push({
        id: agent.id,
        score: dampened.breakdown.total,
        breakdown: dampened.breakdown,
        signalHash,
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
        sybilSignals: dampened.sybilSignals,
        sybilRiskScore: dampened.sybilRiskScore,
      });
    }

    await batchUpdateScoresWithSybil(updates);

    updated += updates.length;
    if (i % 5000 === 0 && i > 0) {
      log(`Trust score progress: ${updated}/${allAgents.length} agents`, "trust-score");
    }
  }

  const elapsed = Date.now() - start;
  log(
    `Trust score recalculation complete: ${updated} agents in ${(elapsed / 1000).toFixed(1)}s`,
    "trust-score",
  );
  return { updated, elapsed };
}

// ─── Incremental recalculation ───────────────────────────────────────────────

export async function ensureScoresCalculated(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE trust_score IS NULL) as unscored,
        COUNT(*) as total
      FROM agents
    `);
    const row = (result as any).rows?.[0];
    const unscored = Number(row?.unscored ?? 0);
    const total = Number(row?.total ?? 0);

    if (total > 0 && unscored / total > 0.5) {
      log(
        `${unscored}/${total} agents unscored (${Math.round((unscored / total) * 100)}%), running batch recalculation`,
        "trust-score",
      );
      await recalculateAllScores();
    } else if (unscored > 0) {
      log(
        `${unscored} agents unscored, running incremental recalculation`,
        "trust-score",
      );
      const {
        feedbackMap,
        controllerChains,
        eventCounts,
        txStatsMap,
        probeStatsMap,
        attestationStatsMap,
      } = await prefetchScoreLookups();
      let scored = 0;
      while (true) {
        const batch = await db
          .select()
          .from(agents)
          .where(isNull(agents.trustScore))
          .limit(500);
        if (batch.length === 0) break;

        const updates: Array<{
          id: string;
          score: number;
          breakdown: TrustScoreBreakdown;
          signalHash: string;
          confidenceScore: number;
          confidenceLevel: string;
        }> = [];
        for (const agent of batch) {
          const feedback = feedbackMap.get(agent.id) ?? null;
          const evtCount = eventCounts.get(agent.id) ?? 0;
          const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
          const txStats = txStatsMap.get(agent.id) ?? { ...EMPTY_TX_STATS };
          const probeStats =
            probeStatsMap.get(agent.id) ?? { ...EMPTY_PROBE_STATS };
          const attestationStats =
            attestationStatsMap.get(agent.id) ?? { ...EMPTY_ATTESTATION_STATS };

          const input: TrustScoreInput = {
            agent,
            txStats,
            attestationStats,
            probeStats,
            feedback,
            metadataEventCount: evtCount,
            chainPresence: crossChain,
          };

          const breakdown = calculateTrustScore(input);
          const signalHash = computeSignalHash(input);
          const confidence = computeConfidence(
            buildConfidenceInput(agent, txStats, probeStats, attestationStats, feedback),
          );
          updates.push({
            id: agent.id,
            score: breakdown.total,
            breakdown,
            signalHash,
            confidenceScore: confidence.score,
            confidenceLevel: confidence.level,
          });
        }

        await batchUpdateScores(updates);
        scored += batch.length;
      }
      log(`Incremental recalculation complete: ${scored} agents scored`, "trust-score");
    } else {
      log(`All ${total} agents have trust scores`, "trust-score");
    }
  } catch (err) {
    log(`Trust score initialization error: ${(err as Error).message}`, "trust-score");
  }
}
