import { type Agent, type CommunityFeedbackSummary, agents } from "../shared/schema.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { eq, isNull, sql } from "drizzle-orm";
import { log } from "./lib/log.js";
import { computeSignalHash, METHODOLOGY_VERSION } from "./trust-provenance.js";
import { computeConfidence } from "./trust-confidence.js";

// ─── Exported helper (shared with trust-provenance) ─────────────────────────

export function looksLikeImageUrl(url: string): boolean {
  if (!url || url.length < 5) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:image/")) return true;
  const clean = lower.split("?")[0].split("#")[0];
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp"];
  if (imageExtensions.some(ext => clean.endsWith(ext))) return true;
  if (lower.includes("/image") || lower.includes("avatar") || lower.includes("logo")) return true;
  if (lower.includes("ipfs://") || lower.includes("arweave")) return true;
  const knownImageHosts = ["blob.8004scan.app", "r2-image-worker", "gateway.autonolas.tech", "meerkat.town", "cloudflare-ipfs"];
  if (knownImageHosts.some(h => lower.includes(h))) return true;
  return false;
}

// ─── Input stat containers (behavioral sources) ─────────────────────────────

export interface TxStats {
  /** Total inbound USD value (0 if none). */
  volumeUsd: number;
  /** Total inbound transaction count. */
  txCount: number;
  /** Number of distinct sender addresses. */
  uniquePayers: number;
  /** Timestamp of first inbound tx, null if none. */
  firstTxAt: Date | null;
}

export interface AttestationStats {
  /** Count of ERC-8004 reputation events received. */
  received: number;
  /** Count of distinct attestor addresses. */
  uniqueAttestors: number;
}
// NOTE: No attestation table exists yet — downstream constructs
// { received: 0, uniqueAttestors: 0 } until that pipeline is built. This
// interface is the container shape for v3.

export interface ProbeStats {
  /** At least one successful probe with 402 response. */
  hasLive402: boolean;
  /** At least one discovered payment address (proxy for v2; full on-chain
   *  verification comes in v3). */
  paymentAddressVerified: boolean;
}

// ─── Scoring API types ──────────────────────────────────────────────────────

export type TrustCategory =
  | "transactions"
  | "reputation"
  | "profile"
  | "longevity"
  | "community";

export interface TrustSignal {
  category: TrustCategory;
  /** Canonical human-readable name — MUST match spec exactly. */
  name: string;
  points: number;
  maxPoints: number;
  earned: boolean;
  detail?: string;
}

export interface TrustOpportunity {
  signal: string;
  category: string;
  maxPoints: number;
  hint: string;
}

export interface TrustScoreBreakdown {
  total: number;
  categories: {
    transactions: number;
    reputation: number;
    profile: number;
    longevity: number;
    community: number;
  };
  signals: TrustSignal[];
  opportunities: TrustOpportunity[];
}

export interface TrustScoreInput {
  agent: Agent;
  txStats: TxStats;
  attestationStats: AttestationStats;
  probeStats: ProbeStats;
  feedback: CommunityFeedbackSummary | null | undefined;
  metadataEventCount: number;
  chainPresence: number;
}

// ─── Category weights (must sum to 100) ─────────────────────────────────────

export const CATEGORY_WEIGHTS = {
  transactions: 35,
  reputation: 25,
  profile: 15,
  longevity: 15,
  community: 10,
} as const;

// ─── Signal thresholds (single source of truth for recalibration) ───────────

export const VOLUME_THRESHOLDS_USD = [0, 100, 1000] as const; // tier entry: any inbound, $100+, $1,000+
export const VOLUME_POINTS = [5, 10, 15] as const;

export const TX_COUNT_THRESHOLDS = [5, 20, 50] as const;
export const TX_COUNT_POINTS = [3, 5, 8] as const;

export const PAYER_DIVERSITY_THRESHOLDS = [3, 10] as const;
export const PAYER_DIVERSITY_POINTS = [3, 5] as const;

export const ATTESTATION_THRESHOLDS = [1, 5, 10, 25] as const;
export const ATTESTATION_POINTS = [3, 7, 12, 18] as const;

export const ATTESTOR_DIVERSITY_THRESHOLDS = [3, 10] as const;
export const ATTESTOR_DIVERSITY_POINTS = [3, 7] as const;

export const DESC_LENGTH_THRESHOLDS = [30, 100] as const;
export const DESC_POINTS = [1, 2] as const;

export const AGE_DAY_THRESHOLDS = [7, 30, 90] as const;
export const AGE_POINTS = [1, 2, 4] as const;

export const METADATA_UPDATE_THRESHOLDS = [1, 3] as const;
export const METADATA_UPDATE_POINTS = [1, 3] as const;

export const CROSS_CHAIN_THRESHOLDS = [2, 3] as const;
export const CROSS_CHAIN_POINTS = [2, 3] as const;

// First tier `0` means "any tx earns the entry tier"
export const FIRST_TX_DAY_THRESHOLDS = [0, 30, 90] as const;
export const FIRST_TX_POINTS = [2, 3, 5] as const;

export const GITHUB_HEALTH_THRESHOLDS = [1, 40, 70] as const;
export const GITHUB_HEALTH_POINTS = [1, 3, 5] as const;

export const FARCASTER_THRESHOLDS = [0.0001, 0.4, 0.7] as const;
export const FARCASTER_POINTS = [1, 2, 3] as const;

export const EARLY_ADOPTER_CUTOFF = new Date("2026-06-01T00:00:00Z");
export const ACTIVE_MAINTAINER_MIN_EVENTS = 3;
export const ACTIVE_MAINTAINER_MIN_AGE_DAYS = 90;

/**
 * Tiered-scoring helper: walks `thresholds` (ascending) and returns the
 * `points[i]` for the highest `thresholds[i]` that `value` meets or exceeds.
 * Returns 0 if `value` does not meet the first threshold.
 */
function tieredScore<T extends number>(
  value: number,
  thresholds: readonly T[],
  points: readonly number[],
): number {
  let earned = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) earned = points[i];
    else break;
  }
  return earned;
}

// ─── Opportunity hints ──────────────────────────────────────────────────────

function getOpportunityHint(signalName: string): string {
  const hints: Record<string, string> = {
    "x402 payment volume": "Receive x402 payments to earn volume tiers (+5 at $1 inbound, +10 at $100, +15 at $1,000)",
    "Transaction count": "Accumulate more inbound transactions (+3 at 5 tx, +5 at 20, +8 at 50)",
    "Payer diversity": "Attract distinct payer addresses (+3 at 3 unique payers, +5 at 10)",
    "x402 endpoint live": "Enable a working x402-gated endpoint so probes return HTTP 402",
    "Payment address verified": "Publish a payment address reachable by x402 probes",
    "Attestations received": "Earn ERC-8004 reputation attestations (+3 at 1, +7 at 5, +12 at 10, +18 at 25)",
    "Attestor diversity": "Get attestations from distinct sources (+3 at 3 unique, +7 at 10)",
    "Profile image": "Add an image URL (PNG, SVG, or IPFS-hosted) to your agent metadata",
    "Description quality": "Add a description of at least 100 characters explaining what your agent does",
    Name: "Set a descriptive agent name in your ERC-8004 metadata",
    Endpoints: "Declare at least one API endpoint in your agent metadata",
    "Skills / Tags": "Add tags or OASF skills/domains to help users discover your agent",
    "Metadata storage": "Store metadata on IPFS or Arweave for immutability (+2 vs +1 HTTPS)",
    "Active status": "Set activeStatus to true in your agent metadata",
    "Registration age": "Trust accumulates over time — agents earn up to +4 after 90 days",
    "Metadata maintenance": "Update your agent metadata (+1 at 1 update, +3 at 3+)",
    "Cross-chain presence": "Deploy or register on 2+ chains (+2 at 2, +3 at 3+)",
    "Time since first transaction": "Earn payment history tiers (+2 any tx, +3 at 30d, +5 at 90d)",
    "GitHub health": "Connect a healthy GitHub repository with recent activity",
    "Farcaster engagement": "Establish a Farcaster presence with strong engagement",
    "Community sources": "Get listed in at least one community data source",
  };
  return hints[signalName] ?? `Improve the "${signalName}" signal`;
}

// ─── Main scoring entry point ────────────────────────────────────────────────

export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  const {
    agent,
    txStats,
    attestationStats,
    probeStats,
    feedback,
    metadataEventCount,
    chainPresence,
  } = input;

  const signals: TrustSignal[] = [];

  // ── Transactions (35 max) ────────────────────────────────────────────────

  // Gate on real inbound payment: txCount>0 AND volumeUsd>0. Otherwise award 0 points.
  const volumePts =
    txStats.txCount > 0 && txStats.volumeUsd > 0
      ? tieredScore(txStats.volumeUsd, VOLUME_THRESHOLDS_USD, VOLUME_POINTS)
      : 0;
  signals.push({
    category: "transactions",
    name: "x402 payment volume",
    points: volumePts,
    maxPoints: VOLUME_POINTS[VOLUME_POINTS.length - 1],
    earned: volumePts > 0,
    detail: volumePts > 0 ? `$${txStats.volumeUsd.toFixed(2)}` : undefined,
  });

  const txCountPts = tieredScore(txStats.txCount, TX_COUNT_THRESHOLDS, TX_COUNT_POINTS);
  signals.push({
    category: "transactions",
    name: "Transaction count",
    points: txCountPts,
    maxPoints: TX_COUNT_POINTS[TX_COUNT_POINTS.length - 1],
    earned: txCountPts > 0,
    detail: txStats.txCount > 0 ? `${txStats.txCount} tx` : undefined,
  });

  const payerPts = tieredScore(txStats.uniquePayers, PAYER_DIVERSITY_THRESHOLDS, PAYER_DIVERSITY_POINTS);
  signals.push({
    category: "transactions",
    name: "Payer diversity",
    points: payerPts,
    maxPoints: PAYER_DIVERSITY_POINTS[PAYER_DIVERSITY_POINTS.length - 1],
    earned: payerPts > 0,
    detail: txStats.uniquePayers > 0 ? `${txStats.uniquePayers} payers` : undefined,
  });

  signals.push({
    category: "transactions",
    name: "x402 endpoint live",
    points: probeStats.hasLive402 ? 5 : 0,
    maxPoints: 5,
    earned: probeStats.hasLive402,
  });

  signals.push({
    category: "transactions",
    name: "Payment address verified",
    points: probeStats.paymentAddressVerified ? 2 : 0,
    maxPoints: 2,
    earned: probeStats.paymentAddressVerified,
  });

  // ── Reputation (25 max) ──────────────────────────────────────────────────

  const attPts = tieredScore(attestationStats.received, ATTESTATION_THRESHOLDS, ATTESTATION_POINTS);
  signals.push({
    category: "reputation",
    name: "Attestations received",
    points: attPts,
    maxPoints: ATTESTATION_POINTS[ATTESTATION_POINTS.length - 1],
    earned: attPts > 0,
    detail: attestationStats.received > 0 ? `${attestationStats.received} received` : undefined,
  });

  const attDiversityPts = tieredScore(
    attestationStats.uniqueAttestors,
    ATTESTOR_DIVERSITY_THRESHOLDS,
    ATTESTOR_DIVERSITY_POINTS,
  );
  signals.push({
    category: "reputation",
    name: "Attestor diversity",
    points: attDiversityPts,
    maxPoints: ATTESTOR_DIVERSITY_POINTS[ATTESTOR_DIVERSITY_POINTS.length - 1],
    earned: attDiversityPts > 0,
    detail: attestationStats.uniqueAttestors > 0 ? `${attestationStats.uniqueAttestors} unique` : undefined,
  });

  // ── Profile (15 max) ─────────────────────────────────────────────────────

  const hasImage = Boolean(agent.imageUrl && looksLikeImageUrl(agent.imageUrl));
  signals.push({
    category: "profile",
    name: "Profile image",
    points: hasImage ? 5 : 0,
    maxPoints: 5,
    earned: hasImage,
    detail: hasImage ? agent.imageUrl! : undefined,
  });

  const descLen = agent.description?.trim().length ?? 0;
  const descPts = tieredScore(descLen, DESC_LENGTH_THRESHOLDS, DESC_POINTS);
  signals.push({
    category: "profile",
    name: "Description quality",
    points: descPts,
    maxPoints: DESC_POINTS[DESC_POINTS.length - 1],
    earned: descPts > 0,
    detail: descLen > 0 ? `${descLen} chars` : undefined,
  });

  const hasName = Boolean(agent.name && agent.name.trim().length > 0);
  signals.push({
    category: "profile",
    name: "Name",
    points: hasName ? 2 : 0,
    maxPoints: 2,
    earned: hasName,
    detail: hasName ? agent.name!.trim() : undefined,
  });

  const endpointsRaw = agent.endpoints as unknown;
  let endpointCount = 0;
  if (endpointsRaw) {
    if (Array.isArray(endpointsRaw)) endpointCount = endpointsRaw.length;
    else if (typeof endpointsRaw === "object") endpointCount = Object.keys(endpointsRaw as Record<string, unknown>).length;
  }
  const hasEndpoints = endpointCount >= 1;
  signals.push({
    category: "profile",
    name: "Endpoints",
    points: hasEndpoints ? 2 : 0,
    maxPoints: 2,
    earned: hasEndpoints,
    detail: endpointCount > 0 ? `${endpointCount} endpoint${endpointCount === 1 ? "" : "s"}` : undefined,
  });

  const skillCount =
    (agent.oasfSkills?.length ?? 0) +
    (agent.oasfDomains?.length ?? 0) +
    (agent.tags?.length ?? 0);
  const hasSkillsOrTags = skillCount > 0;
  signals.push({
    category: "profile",
    name: "Skills / Tags",
    points: hasSkillsOrTags ? 1 : 0,
    maxPoints: 1,
    earned: hasSkillsOrTags,
    detail: hasSkillsOrTags ? `${skillCount}` : undefined,
  });

  const uri = agent.metadataUri ?? "";
  let storagePts = 0;
  let storageDetail: string | undefined;
  if (uri.startsWith("ipfs://")) { storagePts = 2; storageDetail = "ipfs"; }
  else if (uri.startsWith("ar://")) { storagePts = 2; storageDetail = "arweave"; }
  else if (uri.startsWith("https://")) { storagePts = 1; storageDetail = "https"; }
  else if (uri.startsWith("http://")) { storagePts = 0; storageDetail = "http"; }
  else if (uri.startsWith("data:")) { storagePts = 0; storageDetail = "data-uri"; }
  signals.push({
    category: "profile",
    name: "Metadata storage",
    points: storagePts,
    maxPoints: 2,
    earned: storagePts > 0,
    detail: storageDetail,
  });

  const isActive = agent.activeStatus === true;
  signals.push({
    category: "profile",
    name: "Active status",
    points: isActive ? 1 : 0,
    maxPoints: 1,
    earned: isActive,
  });

  // ── Longevity (15 max) ───────────────────────────────────────────────────

  const ageDays = (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const agePts = tieredScore(ageDays, AGE_DAY_THRESHOLDS, AGE_POINTS);
  signals.push({
    category: "longevity",
    name: "Registration age",
    points: agePts,
    maxPoints: AGE_POINTS[AGE_POINTS.length - 1],
    earned: agePts > 0,
    detail: `${Math.floor(ageDays)} days`,
  });

  const maintPts = tieredScore(metadataEventCount, METADATA_UPDATE_THRESHOLDS, METADATA_UPDATE_POINTS);
  signals.push({
    category: "longevity",
    name: "Metadata maintenance",
    points: maintPts,
    maxPoints: METADATA_UPDATE_POINTS[METADATA_UPDATE_POINTS.length - 1],
    earned: maintPts > 0,
    detail: metadataEventCount > 0 ? `${metadataEventCount} updates` : undefined,
  });

  const crossChainPts = tieredScore(chainPresence, CROSS_CHAIN_THRESHOLDS, CROSS_CHAIN_POINTS);
  signals.push({
    category: "longevity",
    name: "Cross-chain presence",
    points: crossChainPts,
    maxPoints: CROSS_CHAIN_POINTS[CROSS_CHAIN_POINTS.length - 1],
    earned: crossChainPts > 0,
    detail: chainPresence > 0 ? `${chainPresence} chains` : undefined,
  });

  // Time since first transaction — special: no tx → 0 pts
  let firstTxPts = 0;
  let firstTxDetail: string | undefined;
  if (txStats.txCount > 0 && txStats.firstTxAt != null) {
    const daysSinceFirst =
      (Date.now() - new Date(txStats.firstTxAt).getTime()) / (1000 * 60 * 60 * 24);
    firstTxPts = tieredScore(daysSinceFirst, FIRST_TX_DAY_THRESHOLDS, FIRST_TX_POINTS);
    firstTxDetail = `${Math.floor(daysSinceFirst)} days`;
  }
  signals.push({
    category: "longevity",
    name: "Time since first transaction",
    points: firstTxPts,
    maxPoints: FIRST_TX_POINTS[FIRST_TX_POINTS.length - 1],
    earned: firstTxPts > 0,
    detail: firstTxDetail,
  });

  // ── Community (10 max) ───────────────────────────────────────────────────

  const ghScore = feedback?.githubHealthScore ?? 0;
  const ghPts = tieredScore(ghScore, GITHUB_HEALTH_THRESHOLDS, GITHUB_HEALTH_POINTS);
  signals.push({
    category: "community",
    name: "GitHub health",
    points: ghPts,
    maxPoints: GITHUB_HEALTH_POINTS[GITHUB_HEALTH_POINTS.length - 1],
    earned: ghPts > 0,
    detail: ghScore > 0 ? `score ${ghScore}` : undefined,
  });

  const fcScore = feedback?.farcasterScore ?? 0;
  const fcPts = tieredScore(fcScore, FARCASTER_THRESHOLDS, FARCASTER_POINTS);
  signals.push({
    category: "community",
    name: "Farcaster engagement",
    points: fcPts,
    maxPoints: FARCASTER_POINTS[FARCASTER_POINTS.length - 1],
    earned: fcPts > 0,
    detail: fcScore > 0 ? `score ${fcScore}` : undefined,
  });

  const hasSources = (feedback?.totalSources ?? 0) > 0;
  signals.push({
    category: "community",
    name: "Community sources",
    points: hasSources ? 2 : 0,
    maxPoints: 2,
    earned: hasSources,
    detail: hasSources ? `${feedback!.totalSources} sources` : undefined,
  });

  // ── Tally categories from signals ───────────────────────────────────────

  const sumCat = (c: TrustCategory) =>
    signals.filter(s => s.category === c).reduce((a, s) => a + s.points, 0);

  const categories = {
    transactions: sumCat("transactions"),
    reputation: sumCat("reputation"),
    profile: sumCat("profile"),
    longevity: sumCat("longevity"),
    community: sumCat("community"),
  };

  const total =
    categories.transactions +
    categories.reputation +
    categories.profile +
    categories.longevity +
    categories.community;

  // ── Opportunities: unearned signals with maxPoints >= 3 ─────────────────

  const opportunities: TrustOpportunity[] = signals
    .filter(s => !s.earned && s.maxPoints >= 3)
    .map(s => ({
      signal: s.name,
      category: s.category,
      maxPoints: s.maxPoints,
      hint: getOpportunityHint(s.name),
    }));

  return { total, categories, signals, opportunities };
}

// ─── Recalculate pipeline ────────────────────────────────────────────────────

/**
 * Pre-fetch all lookup maps needed for trust score calculation.
 * Returns maps keyed by agent.id (or controller address for chainPresence).
 */
async function prefetchScoreLookups() {
  const feedbackMap = new Map<string, CommunityFeedbackSummary>();
  try {
    const summaries = await db.select().from(
      (await import("../shared/schema.js")).communityFeedbackSummaries
    );
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

/** Batch-update trust scores (no sybil) for a set of agents in a single SQL. */
async function batchUpdateScores(updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string }>) {
  if (updates.length === 0) return;
  const now = new Date();
  const ids = updates.map(u => u.id);
  const scores = updates.map(u => u.score);
  const breakdowns = updates.map(u => JSON.stringify(u.breakdown));
  const hashes = updates.map(u => u.signalHash);
  const confScores = updates.map(u => u.confidenceScore);
  const confLevels = updates.map(u => u.confidenceLevel);

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

async function batchUpdateScoresWithSybil(updates: Array<{
  id: string; score: number; breakdown: TrustScoreBreakdown;
  signalHash: string; confidenceScore: number; confidenceLevel: string;
  sybilSignals: any; sybilRiskScore: number;
}>) {
  if (updates.length === 0) return;
  const now = new Date();

  // Use json_to_recordset to avoid pg array serialization issues with nullable columns.
  const data = JSON.stringify(updates.map(u => ({
    id: u.id,
    score: u.score,
    breakdown: JSON.stringify(u.breakdown),
    hash: u.signalHash,
    conf_score: u.confidenceScore,
    conf_level: u.confidenceLevel,
    sybil_sig: u.sybilSignals != null ? JSON.stringify(u.sybilSignals) : null,
    sybil_risk: u.sybilRiskScore,
  })));

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

/** One-shot recalc for a single agent. */
export async function recalculateScore(agentId: string): Promise<TrustScoreBreakdown | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  const events = await storage.getAgentEvents(agentId);
  const eventCount = events.filter(e => e.eventType === "MetadataUpdated" || e.eventType === "AgentURISet").length;

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

  const breakdown = calculateTrustScore(input);
  const signalHash = computeSignalHash(input);
  const confidence = computeConfidence({
    hasIdentity: !!(agent.name && agent.name.trim().length > 0),
    hasProbes: probeStats.hasLive402 || probeStats.paymentAddressVerified,
    hasTransactions: txStats.txCount > 0,
    hasAttestations: attestationStats.received > 0,
    hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
    hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
  });

  await db.update(agents).set({
    trustScore: breakdown.total,
    trustScoreBreakdown: breakdown,
    trustScoreUpdatedAt: new Date(),
    trustSignalHash: signalHash,
    trustMethodologyVersion: METHODOLOGY_VERSION,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
  }).where(eq(agents.id, agentId));

  return breakdown;
}

export async function recalculateAllScores(): Promise<{ updated: number; elapsed: number }> {
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
  const { analyzeSybilSignals, prefetchSybilLookups } = await import("./sybil-detection.js");
  const sybilLookups = await prefetchSybilLookups(db);
  log(`Sybil lookups: ${sybilLookups.controllerAgentCounts.size} flagged controllers, ${sybilLookups.fingerprintControllers.size} fingerprint clusters`, "trust-score");

  let updated = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
    const batch = allAgents.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string; sybilSignals: any; sybilRiskScore: number }> = [];

    for (const agent of batch) {
      const feedback = feedbackMap.get(agent.id) ?? null;
      const evtCount = eventCounts.get(agent.id) ?? 0;
      const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
      const txStats = txStatsMap.get(agent.id) ?? { ...EMPTY_TX_STATS };
      const probeStats = probeStatsMap.get(agent.id) ?? { ...EMPTY_PROBE_STATS };
      const attestationStats = attestationStatsMap.get(agent.id) ?? { ...EMPTY_ATTESTATION_STATS };

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
      const confidence = computeConfidence({
        hasIdentity: !!(agent.name && agent.name.trim().length > 0),
        hasProbes: probeStats.hasLive402 || probeStats.paymentAddressVerified,
        hasTransactions: txStats.txCount > 0,
        hasAttestations: attestationStats.received > 0,
        hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
        hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
      });
      const sybil = analyzeSybilSignals(
        agent.id,
        agent.controllerAddress,
        agent.metadataFingerprint,
        sybilLookups,
      );
      const dampenedScore = Math.round(breakdown.total * sybil.dampeningMultiplier);
      updates.push({
        id: agent.id,
        score: dampenedScore,
        breakdown: { ...breakdown, total: dampenedScore },
        signalHash,
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
        sybilSignals: sybil.signals.length > 0 ? sybil.signals : null,
        sybilRiskScore: sybil.riskScore,
      });
    }

    await batchUpdateScoresWithSybil(updates);

    updated += updates.length;
    if (i % 5000 === 0 && i > 0) {
      log(`Trust score progress: ${updated}/${allAgents.length} agents`, "trust-score");
    }
  }

  const elapsed = Date.now() - start;
  log(`Trust score recalculation complete: ${updated} agents in ${(elapsed / 1000).toFixed(1)}s`, "trust-score");
  return { updated, elapsed };
}

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
      log(`${unscored}/${total} agents unscored (${Math.round(unscored / total * 100)}%), running batch recalculation`, "trust-score");
      await recalculateAllScores();
    } else if (unscored > 0) {
      log(`${unscored} agents unscored, running incremental recalculation`, "trust-score");
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
        const batch = await db.select().from(agents).where(isNull(agents.trustScore)).limit(500);
        if (batch.length === 0) break;

        const updates: Array<{ id: string; score: number; breakdown: TrustScoreBreakdown; signalHash: string; confidenceScore: number; confidenceLevel: string }> = [];
        for (const agent of batch) {
          const feedback = feedbackMap.get(agent.id) ?? null;
          const evtCount = eventCounts.get(agent.id) ?? 0;
          const crossChain = controllerChains.get(agent.controllerAddress) ?? 0;
          const txStats = txStatsMap.get(agent.id) ?? { ...EMPTY_TX_STATS };
          const probeStats = probeStatsMap.get(agent.id) ?? { ...EMPTY_PROBE_STATS };
          const attestationStats = attestationStatsMap.get(agent.id) ?? { ...EMPTY_ATTESTATION_STATS };

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
          const confidence = computeConfidence({
            hasIdentity: !!(agent.name && agent.name.trim().length > 0),
            hasProbes: probeStats.hasLive402 || probeStats.paymentAddressVerified,
            hasTransactions: txStats.txCount > 0,
            hasAttestations: attestationStats.received > 0,
            hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
            hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
          });
          updates.push({ id: agent.id, score: breakdown.total, breakdown, signalHash, confidenceScore: confidence.score, confidenceLevel: confidence.level });
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
