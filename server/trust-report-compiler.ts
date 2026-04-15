import {
  type Agent,
  type CommunityFeedbackSummary,
  type X402Probe,
  type TrustReport,
  trustAnchors,
  trustReports,
  x402Probes,
} from "../shared/schema.js";
import { CHAIN_CONFIGS } from "../shared/chains.js";
import {
  type AttestationStats,
  type ProbeStats,
  type TrustScoreBreakdown,
  type TrustScoreInput,
  type TxStats,
  calculateTrustScore,
} from "./trust-score.js";
import { computeConfidence, type ConfidenceResult } from "./trust-confidence.js";
import { computeVerifications, type Verification } from "./trust-verifications.js";
import { buildConfidenceInput } from "./trust-score-pipeline.js";
import { computeDampeningMultiplier } from "./sybil-detection.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { eq, sql, lt } from "drizzle-orm";
import { log } from "./lib/log.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * 6-tier verdict (methodology v2).
 *
 * UPPERCASE in memory and in the JSON blobs. The `verdict` column in
 * `trust_reports` is lowercased at write time for backward compatibility
 * with existing SQL aggregation queries.
 */
export type Verdict =
  | "VERIFIED"           // 80-100
  | "TRUSTED"            // 60-79
  | "BUILDING"           // 40-59
  | "INSUFFICIENT_DATA"  // 20-39
  | "UNVERIFIED"         // 5-19 (and default for 0-4 without active negative evidence)
  | "FLAGGED";           // only when active negative evidence present

/** Evidence basis — "how much do we know" companion to the score. */
export interface EvidenceBasis {
  transactionCount: number;
  attestationCount: number;
  uniquePayers: number;
  uniqueAttestors: number;
  dataSources: string[];
  summary: string;
}

export interface QuickCheckData {
  address: string;
  chainId: number | null;
  name: string | null;
  verdict: Verdict;
  score: number;
  scoreBreakdown: TrustScoreBreakdown;
  qualityTier: string;
  flags: string[];
  x402Active: boolean;
  ageInDays: number;
  crossChainPresence: number;
  transactionCount: number;
  verificationCount: number;
  evidenceBasis: EvidenceBasis;
  reportAvailable: boolean;
  generatedAt: string;
  reportVersion: number;
}

export interface ProvenanceAnchor {
  merkleRoot: string;
  merkleProof: string[];
  leafHash: string;
  anchoredScore: number;
  anchoredMethodologyVersion: number;
  txHash: string | null;
  blockNumber: number | null;
  anchoredAt: string;
  contractAddress: string | null;
  chain: string;
  verificationUrl: string | null;
}

export interface TrustRating {
  score: number;
  verdict: Verdict;
  breakdown: TrustScoreBreakdown;
  evidenceBasis: EvidenceBasis;
  confidence: ConfidenceResult;
  provenance: {
    signalHash: string | null;
    /**
     * Methodology version that produced the persisted score — `null` when the
     * agent has never been scored. Consumers should treat null as "report
     * synthesized from current data but provenance not yet captured"; a
     * non-null value always pairs with a non-null signalHash + scoredAt.
     */
    methodologyVersion: number | null;
    scoredAt: string | null;
    disclaimer: string;
    anchor: ProvenanceAnchor | null;
  };
  qualityTier: string;
  spamFlags: string[];
  lifecycleStatus: string;
  updatedAt: string | null;
}

export interface FullReportData {
  agent: {
    id: string;
    erc8004Id: string;
    name: string | null;
    description: string | null;
    chains: number[];
    imageUrl: string | null;
    slug: string | null;
    endpoints: any[];
    capabilities: string[];
    skills: string[];
  };
  trustRating: TrustRating;
  verifications: Verification[];
  onChain: {
    firstSeenAt: string | null;
    ageInDays: number;
    metadataEvents: number;
    crossChainCount: number;
    chains: Array<{ chainId: number; name: string; firstSeenBlock: number }>;
  };
  economy: {
    x402Support: boolean;
    paymentAddresses: Array<{ address: string; network: string; token: string }>;
    transactionCount: number;
    totalVolumeUsd: number;
    topTokens: Array<{ symbol: string; count: number; volumeUsd: number }>;
  };
  community: {
    githubHealthScore: number | null;
    githubStars: number | null;
    githubForks: number | null;
    githubLastCommitAt: string | null;
    githubContributors: number | null;
    farcasterScore: number | null;
    farcasterFollowers: number | null;
    totalSources: number;
  };
  meta: {
    generatedAt: string;
    reportVersion: number;
    dataFreshness: {
      trustScore: string | null;
      probes: string | null;
      transactions: string | null;
      community: string | null;
    };
  };
  sybil: {
    signals: Array<{ type: string; severity: string; detail: string; value: number }>;
    riskScore: number;
    dampeningApplied: boolean;
    rawScoreBeforeDampening: number | null;
  } | null;
}

// Report schema v3 (two-layer with evidenceBasis) pairs with methodology v2.
// Schema version is independent of methodology version — bumped on any breaking shape change.
export const REPORT_VERSION = 3;
const REPORT_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Normalize `agent.endpoints` (jsonb, shape varies) into an array form. */
function normalizeEndpoints(endpoints: unknown): Array<{ name: string; url: string }> {
  if (!endpoints) return [];
  if (Array.isArray(endpoints)) return endpoints as Array<{ name: string; url: string }>;
  if (typeof endpoints === "object") {
    return Object.entries(endpoints as Record<string, any>).map(([name, url]) => ({
      name,
      url: typeof url === "string" ? url : JSON.stringify(url),
    }));
  }
  return [];
}

const DISCLAIMER =
  "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.";

// ─── Verdict logic (6-tier, v2) ──────────────────────────────────────────────

export interface VerdictInput {
  score: number;
  qualityTier: string | null;
  spamFlags: string[] | null;
  lifecycleStatus: string | null;
}

/**
 * Compute a 6-tier verdict from score + active-negative-evidence signals.
 *
 * FLAGGED is reserved for ACTIVE negative evidence (spam/archived quality
 * tier, archived lifecycle, or spam flags plus a very low score). A benign
 * low-data agent at score 3 stays UNVERIFIED — benefit of the doubt.
 */
export function computeVerdict(input: VerdictInput): Verdict {
  const flags = input.spamFlags ?? [];
  const tier = input.qualityTier;
  const status = input.lifecycleStatus ?? "active";

  // Hard FLAGGED: active negative evidence required
  if (tier === "spam" || tier === "archived") return "FLAGGED";
  if (status === "archived") return "FLAGGED";
  if (flags.length > 0 && input.score < 10) return "FLAGGED";

  // Score-based tiers
  if (input.score >= 80) return "VERIFIED";
  if (input.score >= 60) return "TRUSTED";
  if (input.score >= 40) return "BUILDING";
  if (input.score >= 20) return "INSUFFICIENT_DATA";
  if (input.score >= 5) return "UNVERIFIED";
  // 0-4 without active negative evidence → benefit of the doubt
  return "UNVERIFIED";
}

// ─── Evidence basis ──────────────────────────────────────────────────────────

export function computeEvidenceBasis(
  txStats: TxStats,
  attestationStats: AttestationStats,
  probeStats: ProbeStats,
  feedback: CommunityFeedbackSummary | null | undefined,
  agent: Pick<Agent, "name">,
): EvidenceBasis {
  const txCount = txStats.txCount;
  // NOTE: v2 has attestations=0 always; branches below activate in v3.
  const attCount = attestationStats.received;
  const uniquePayers = txStats.uniquePayers;
  const uniqueAttestors = attestationStats.uniqueAttestors;

  const dataSources: string[] = [];
  if (agent.name && agent.name.trim().length > 0) dataSources.push("identity");
  if (txCount > 0) dataSources.push("transactions");
  if (attCount > 0) dataSources.push("attestations");
  if (probeStats.hasLive402 || probeStats.paymentAddressVerified) dataSources.push("x402_probes");
  if ((feedback?.githubHealthScore ?? 0) > 0) dataSources.push("github");
  if ((feedback?.farcasterScore ?? 0) > 0) dataSources.push("farcaster");

  let summary: string;
  if (txCount === 0 && attCount === 0) {
    summary = "Based on profile data only — no verified transactions recorded yet";
  } else if (txCount > 0 && attCount === 0) {
    summary = `Based on ${txCount} verified transaction${txCount === 1 ? "" : "s"}`;
  } else if (txCount === 0 && attCount > 0) {
    summary = `Based on ${attCount} on-chain attestation${attCount === 1 ? "" : "s"}`;
  } else if (txCount >= 5 && uniquePayers >= 3) {
    summary = `Based on ${txCount} transactions from ${uniquePayers} unique payers and ${attCount} attestation${attCount === 1 ? "" : "s"}`;
  } else {
    summary = `Based on ${txCount} verified transaction${txCount === 1 ? "" : "s"} and ${attCount} attestation${attCount === 1 ? "" : "s"}`;
  }

  return {
    transactionCount: txCount,
    attestationCount: attCount,
    uniquePayers,
    uniqueAttestors,
    dataSources,
    summary,
  };
}

// ─── Data fetching helpers ───────────────────────────────────────────────────

async function getAgentCrossChainData(controllerAddress: string): Promise<{
  count: number;
  chains: Array<{ chainId: number; name: string; firstSeenBlock: number }>;
}> {
  try {
    const result = await db.execute(sql`
      SELECT chain_id, first_seen_block FROM agents
      WHERE controller_address = ${controllerAddress}
      ORDER BY chain_id
    `);
    const rows = (result as any).rows ?? [];
    const chains = rows.map((r: any) => ({
      chainId: Number(r.chain_id),
      name: CHAIN_CONFIGS[Number(r.chain_id)]?.name ?? `Chain ${r.chain_id}`,
      firstSeenBlock: Number(r.first_seen_block),
    }));
    return { count: chains.length, chains };
  } catch {
    return { count: 0, chains: [] };
  }
}

async function getAgentEventCount(agentId: string): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM agent_metadata_events
      WHERE agent_id = ${agentId}
      AND event_type IN ('MetadataUpdated', 'AgentURISet')
    `);
    return Number((result as any).rows?.[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

async function getAgentProbes(agentId: string): Promise<X402Probe[]> {
  try {
    return await db.select().from(x402Probes)
      .where(eq(x402Probes.agentId, agentId))
      .orderBy(sql`probed_at DESC`)
      .limit(20);
  } catch {
    return [];
  }
}

/**
 * Fetch tx aggregate stats + per-token breakdown.
 *
 * Returns both the scoring-grade `TxStats` (volume, count, payers, firstTxAt)
 * and the report-grade breakdown fields (top tokens, last tx timestamp).
 */
async function getAgentTransactionAggregate(agentId: string): Promise<{
  txStats: TxStats;
  totalVolumeUsd: number;
  topTokens: Array<{ symbol: string; count: number; volumeUsd: number }>;
  lastTxAt: string | null;
}> {
  try {
    const result = await db.execute(sql`
      WITH stats AS (
        SELECT
          COUNT(*)::int as total_count,
          COALESCE(SUM(amount_usd), 0)::float as total_volume_usd,
          COUNT(DISTINCT from_address)::int as unique_payers,
          MIN(block_timestamp) as first_tx_at,
          MAX(block_timestamp) as last_tx_at
        FROM agent_transactions WHERE agent_id = ${agentId}
      ),
      tokens AS (
        SELECT token_symbol, COUNT(*)::int as count,
               COALESCE(SUM(amount_usd), 0)::float as volume_usd
        FROM agent_transactions WHERE agent_id = ${agentId}
        GROUP BY token_symbol ORDER BY volume_usd DESC LIMIT 5
      )
      SELECT
        s.total_count, s.total_volume_usd, s.unique_payers,
        s.first_tx_at, s.last_tx_at,
        COALESCE(json_agg(json_build_object(
          'symbol', t.token_symbol, 'count', t.count, 'volumeUsd', t.volume_usd
        )) FILTER (WHERE t.token_symbol IS NOT NULL), '[]') as top_tokens
      FROM stats s LEFT JOIN tokens t ON true
      GROUP BY s.total_count, s.total_volume_usd, s.unique_payers,
               s.first_tx_at, s.last_tx_at
    `);
    const row = (result as any).rows?.[0];
    if (!row) {
      return {
        txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 0, firstTxAt: null },
        totalVolumeUsd: 0,
        topTokens: [],
        lastTxAt: null,
      };
    }

    const totalCount = Number(row.total_count ?? 0);
    const totalVolumeUsd = Number(row.total_volume_usd ?? 0);
    const uniquePayers = Number(row.unique_payers ?? 0);
    const firstTxAt = row.first_tx_at ? new Date(row.first_tx_at) : null;
    const lastTxAtRaw = row.last_tx_at;
    const lastTxAt =
      lastTxAtRaw?.toISOString?.() ?? (lastTxAtRaw ? String(lastTxAtRaw) : null);

    const topTokens =
      (typeof row.top_tokens === "string" ? JSON.parse(row.top_tokens) : row.top_tokens) ?? [];

    return {
      txStats: {
        volumeUsd: totalVolumeUsd,
        txCount: totalCount,
        uniquePayers,
        firstTxAt,
      },
      totalVolumeUsd,
      topTokens,
      lastTxAt,
    };
  } catch {
    return {
      txStats: { volumeUsd: 0, txCount: 0, uniquePayers: 0, firstTxAt: null },
      totalVolumeUsd: 0,
      topTokens: [],
      lastTxAt: null,
    };
  }
}

/** Derive `ProbeStats` from the already-fetched probe rows. */
function deriveProbeStats(probes: X402Probe[]): ProbeStats {
  let hasLive402 = false;
  let paymentAddressVerified = false;
  for (const p of probes) {
    if (p.probeStatus === "success" && p.httpStatus === 402) hasLive402 = true;
    if (p.probeStatus === "success" && p.paymentAddress) paymentAddressVerified = true;
    if (hasLive402 && paymentAddressVerified) break;
  }
  return { hasLive402, paymentAddressVerified };
}

// ─── Compilers ───────────────────────────────────────────────────────────────

export function compileQuickCheck(
  agent: Agent,
  breakdown: TrustScoreBreakdown,
  crossChainData: { count: number },
  txStats: TxStats,
  verdict: Verdict,
  verifications: Verification[],
  evidenceBasis: EvidenceBasis,
): QuickCheckData {
  const ageDays = Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return {
    address: agent.primaryContractAddress,
    chainId: agent.chainId,
    name: agent.name,
    verdict,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    qualityTier: agent.qualityTier ?? "unclassified",
    flags: agent.spamFlags ?? [],
    x402Active: agent.x402Support === true,
    ageInDays: ageDays,
    crossChainPresence: crossChainData.count,
    transactionCount: txStats.txCount,
    verificationCount: verifications.filter(v => v.earned).length,
    evidenceBasis,
    reportAvailable: true,
    generatedAt: new Date().toISOString(),
    reportVersion: REPORT_VERSION,
  };
}

export interface CompileFullReportArgs {
  agent: Agent;
  breakdown: TrustScoreBreakdown;
  crossChainData: { count: number; chains: Array<{ chainId: number; name: string; firstSeenBlock: number }> };
  eventCount: number;
  probes: X402Probe[];
  txStats: TxStats;
  txReportStats: {
    totalVolumeUsd: number;
    topTokens: Array<{ symbol: string; count: number; volumeUsd: number }>;
    lastTxAt: string | null;
  };
  feedback: CommunityFeedbackSummary | null;
  verdict: Verdict;
  confidence: ConfidenceResult;
  evidenceBasis: EvidenceBasis;
  verifications: Verification[];
  /** Score total BEFORE sybil dampening, for provenance on the sybil block. */
  preDampeningTotal: number;
}

export function compileFullReport(args: CompileFullReportArgs): FullReportData {
  const {
    agent, breakdown, crossChainData, eventCount, probes,
    txStats, txReportStats, feedback,
    verdict, confidence, evidenceBasis, verifications, preDampeningTotal,
  } = args;

  const ageDays = Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  // Extract payment addresses from successful probes
  const paymentAddresses = probes
    .filter(p => p.probeStatus === "success" && p.paymentAddress)
    .reduce((acc, p) => {
      const key = p.paymentAddress!;
      if (!acc.some(a => a.address === key)) {
        acc.push({
          address: key,
          network: p.paymentNetwork ?? "unknown",
          token: p.paymentToken ?? "unknown",
        });
      }
      return acc;
    }, [] as Array<{ address: string; network: string; token: string }>);

  // Normalize endpoints to array form for the report shape.
  const endpointList = normalizeEndpoints(agent.endpoints);

  const latestProbeAt = probes.length > 0 ? probes[0].probedAt.toISOString() : null;

  return {
    agent: {
      id: agent.id,
      erc8004Id: agent.erc8004Id,
      name: agent.name,
      description: agent.description,
      chains: crossChainData.chains.map(c => c.chainId),
      imageUrl: agent.imageUrl,
      slug: agent.slug,
      endpoints: endpointList,
      capabilities: agent.capabilities ?? [],
      skills: agent.oasfSkills ?? [],
    },
    trustRating: {
      score: breakdown.total,
      verdict,
      breakdown,
      evidenceBasis,
      confidence,
      provenance: {
        signalHash: agent.trustSignalHash ?? null,
        // Emit the methodology version ACTUALLY persisted for this agent.
        // If never scored, stays null — don't default to current version, as
        // that would claim provenance we don't have. Paired with signalHash +
        // scoredAt so consumers can verify: all three non-null ⇒ fully
        // audited; any null ⇒ incomplete provenance.
        methodologyVersion: agent.trustMethodologyVersion ?? null,
        scoredAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
        disclaimer: DISCLAIMER,
        anchor: null,
      },
      qualityTier: agent.qualityTier ?? "unclassified",
      spamFlags: agent.spamFlags ?? [],
      lifecycleStatus: agent.lifecycleStatus ?? "active",
      updatedAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
    },
    verifications,
    onChain: {
      firstSeenAt: agent.createdAt.toISOString(),
      ageInDays: ageDays,
      metadataEvents: eventCount,
      crossChainCount: crossChainData.count,
      chains: crossChainData.chains,
    },
    economy: {
      x402Support: agent.x402Support === true,
      paymentAddresses,
      transactionCount: txStats.txCount,
      totalVolumeUsd: txReportStats.totalVolumeUsd,
      topTokens: txReportStats.topTokens,
    },
    community: {
      githubHealthScore: feedback?.githubHealthScore ?? null,
      githubStars: feedback?.githubStars ?? null,
      githubForks: feedback?.githubForks ?? null,
      githubLastCommitAt: feedback?.githubLastCommitAt?.toISOString() ?? null,
      githubContributors: feedback?.githubContributors ?? null,
      farcasterScore: feedback?.farcasterScore ?? null,
      farcasterFollowers: feedback?.farcasterFollowers ?? null,
      totalSources: feedback?.totalSources ?? 0,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      reportVersion: REPORT_VERSION,
      dataFreshness: {
        trustScore: agent.trustScoreUpdatedAt?.toISOString() ?? null,
        probes: latestProbeAt,
        transactions: txReportStats.lastTxAt,
        community: feedback?.lastUpdatedAt?.toISOString() ?? null,
      },
    },
    sybil: agent.sybilSignals ? {
      signals: agent.sybilSignals as any[],
      riskScore: agent.sybilRiskScore ?? 0,
      dampeningApplied: (agent.sybilRiskScore ?? 0) > 0,
      rawScoreBeforeDampening: (agent.sybilRiskScore ?? 0) > 0 ? preDampeningTotal : null,
    } : null,
  };
}

// ─── Core operations ─────────────────────────────────────────────────────────

/**
 * Compile and cache a trust report for a given agent.
 *
 * Fetches raw inputs, builds the v2 `TrustScoreInput`, runs the pure scorer,
 * applies the same sybil dampening the recalc pipeline applies (reusing the
 * persisted `sybilRiskScore` on the agent row — batch path authoritative),
 * derives the verdict + verifications + evidence basis, and upserts a cached
 * `trust_reports` row.
 */
export async function compileAndCacheReport(agentId: string): Promise<TrustReport | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  // Fetch everything in parallel.
  const [crossChainData, eventCount, probes, txAggregate, feedbackRaw, anchorRow] = await Promise.all([
    getAgentCrossChainData(agent.controllerAddress),
    getAgentEventCount(agentId),
    getAgentProbes(agentId),
    getAgentTransactionAggregate(agentId),
    storage.getCommunityFeedbackSummary(agentId).then(v => v ?? null).catch(() => null),
    db.select().from(trustAnchors).where(eq(trustAnchors.agentId, agentId)).limit(1)
      .then(rows => rows[0] ?? null)
      .catch(() => null),
  ]);

  const feedback: CommunityFeedbackSummary | null = feedbackRaw;
  const { txStats, ...txReportStats } = txAggregate;
  const probeStats = deriveProbeStats(probes);

  // TODO(v3): wire a real attestation pipeline. Until then the scorer sees
  // zero received/attestors for everyone.
  const attestationStats: AttestationStats = { received: 0, uniqueAttestors: 0 };

  const scoreInput: TrustScoreInput = {
    agent,
    txStats,
    attestationStats,
    probeStats,
    feedback,
    metadataEventCount: eventCount,
    chainPresence: crossChainData.count,
  };

  const rawBreakdown = calculateTrustScore(scoreInput);
  const preDampeningTotal = rawBreakdown.total;

  // Apply sybil dampening using the persisted risk score from the recalc
  // pipeline. Duplicates the 3-line logic in trust-score-pipeline.ts
  // `applySybilDampening` — see that file for the authoritative version. We
  // use the persisted score here rather than re-running the analyzer so the
  // compiler stays decoupled from the sybil lookup prefetch path.
  const sybilMultiplier = computeDampeningMultiplier(agent.sybilRiskScore ?? 0);
  const dampenedTotal = Math.round(preDampeningTotal * sybilMultiplier);
  const breakdown: TrustScoreBreakdown = { ...rawBreakdown, total: dampenedTotal };

  // Verdict — 6-tier v2.
  const verdict = computeVerdict({
    score: breakdown.total,
    qualityTier: agent.qualityTier,
    spamFlags: agent.spamFlags,
    lifecycleStatus: agent.lifecycleStatus,
  });

  // Verifications — always emit all 9.
  const verifications = computeVerifications({
    agent,
    txStats,
    probeStats,
    feedback,
    metadataEventCount: eventCount,
    chainPresence: crossChainData.count,
  });

  // Evidence basis.
  const evidenceBasis = computeEvidenceBasis(txStats, attestationStats, probeStats, feedback, agent);

  // Confidence — reuse the shared `buildConfidenceInput` helper from the
  // pipeline so this file and the recalc path stay in lockstep. Consistency
  // flags remain per-caller (the compiler knows about live probes/endpoints).
  const endpointCount = normalizeEndpoints(agent.endpoints).length;
  const confidence = computeConfidence(
    buildConfidenceInput(agent, txStats, probeStats, attestationStats, feedback),
    {
      x402ActiveButNoTransactions: agent.x402Support === true && txStats.txCount === 0,
      endpointsDeclaredButAllFail:
        endpointCount > 0 && probes.length > 0 && probes.every(p => p.probeStatus !== "success"),
    },
  );

  const quickCheckData = compileQuickCheck(
    agent, breakdown, crossChainData, txStats, verdict, verifications, evidenceBasis,
  );
  const fullReportData = compileFullReport({
    agent, breakdown, crossChainData, eventCount, probes,
    txStats, txReportStats,
    feedback, verdict, confidence, evidenceBasis, verifications,
    preDampeningTotal,
  });

  // Patch anchor proof into provenance (if present).
  if (anchorRow) {
    const trustRootAddress = process.env.TRUST_ROOT_ADDRESS ?? null;
    fullReportData.trustRating.provenance.anchor = {
      merkleRoot: anchorRow.merkleRoot,
      merkleProof: anchorRow.merkleProof as string[],
      leafHash: anchorRow.leafHash,
      anchoredScore: anchorRow.anchoredScore,
      anchoredMethodologyVersion: anchorRow.anchoredMethodologyVersion,
      txHash: anchorRow.anchorTxHash,
      blockNumber: anchorRow.anchorBlockNumber,
      anchoredAt: anchorRow.anchoredAt.toISOString(),
      contractAddress: anchorRow.anchorTxHash ? trustRootAddress : null,
      chain: "base",
      verificationUrl: anchorRow.anchorTxHash
        ? `https://basescan.org/tx/${anchorRow.anchorTxHash}`
        : null,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REPORT_TTL_MS);

  // Upsert: one report per agent. `verdict` column stays lowercase for
  // backward compat with existing SQL aggregation queries.
  const [report] = await db.insert(trustReports).values({
    agentId,
    lookupAddress: agent.primaryContractAddress.toLowerCase(),
    lookupChainId: agent.chainId,
    verdict: verdict.toLowerCase(),
    score: breakdown.total,
    tier: agent.qualityTier ?? "unclassified",
    quickCheckData,
    fullReportData,
    reportVersion: REPORT_VERSION,
    compiledAt: now,
    expiresAt,
  }).onConflictDoUpdate({
    target: trustReports.agentId,
    set: {
      lookupAddress: agent.primaryContractAddress.toLowerCase(),
      lookupChainId: agent.chainId,
      verdict: verdict.toLowerCase(),
      score: breakdown.total,
      tier: agent.qualityTier ?? "unclassified",
      quickCheckData,
      fullReportData,
      reportVersion: REPORT_VERSION,
      compiledAt: now,
      expiresAt,
    },
  }).returning();

  return report;
}

/**
 * Resolve an agent by any address type: primary contract, controller, or payment address.
 * Priority: contract address > controller address > payment address from x402 probes.
 */
export async function resolveAgentByAddress(address: string, chainId?: number): Promise<Agent | null> {
  const addr = address.toLowerCase();

  // 1. Contract or controller address (single query with OR, prioritize contract match)
  try {
    const chainFilter = chainId ? sql` AND chain_id = ${chainId}` : sql``;
    const result = await db.execute(sql`
      SELECT *,
        CASE WHEN LOWER(primary_contract_address) = ${addr} THEN 0 ELSE 1 END as match_priority
      FROM agents
      WHERE (LOWER(primary_contract_address) = ${addr} OR LOWER(controller_address) = ${addr})
      ${chainFilter}
      ORDER BY match_priority, trust_score DESC NULLS LAST
      LIMIT 1
    `);
    const rows = (result as any).rows ?? [];
    if (rows.length > 0) {
      // Re-fetch via storage to get a properly typed object.
      return (await storage.getAgent(rows[0].id)) ?? null;
    }
  } catch {}

  // 2. Payment address (from x402 probes)
  try {
    const probeResult = await db.select({ agentId: x402Probes.agentId }).from(x402Probes)
      .where(sql`LOWER(payment_address) = ${addr}`)
      .limit(1);
    if (probeResult.length > 0) {
      return (await storage.getAgent(probeResult[0].agentId)) ?? null;
    }
  } catch {}

  return null;
}

/**
 * Get a cached report or compile on-demand if stale/missing.
 */
export async function getOrCompileReport(address: string, chainId?: number): Promise<{
  report: TrustReport;
  compiled: boolean;
} | null> {
  const agent = await resolveAgentByAddress(address, chainId);
  if (!agent) return null;

  try {
    const cached = await db.select().from(trustReports)
      .where(eq(trustReports.agentId, agent.id))
      .limit(1);

    // Invalidate cache on both staleness AND report-version mismatch. After a
    // methodology/report-shape bump, any cached v1/v2 blob is the wrong shape
    // even if still within TTL — force recompile rather than return malformed
    // data to paid x402 clients.
    if (
      cached.length > 0 &&
      new Date(cached[0].expiresAt) > new Date() &&
      cached[0].reportVersion === REPORT_VERSION
    ) {
      return { report: cached[0], compiled: false };
    }
  } catch {}

  const report = await compileAndCacheReport(agent.id);
  if (!report) return null;

  return { report, compiled: true };
}

/**
 * Increment access counter (fire-and-forget, don't await in request path).
 */
export function incrementAccessCount(reportId: number, tier: "quick" | "full"): void {
  const update = tier === "quick"
    ? { quickCheckAccessCount: sql`${trustReports.quickCheckAccessCount} + 1` }
    : { fullReportAccessCount: sql`${trustReports.fullReportAccessCount} + 1` };
  db.update(trustReports).set(update).where(eq(trustReports.id, reportId)).catch(() => {});
}

/**
 * Batch recompile reports for agents whose cached reports are stale.
 * Called from Trigger.dev recalculate task.
 */
export async function batchRecompileReports(options?: { limit?: number }): Promise<{ recompiled: number; elapsed: number }> {
  const start = Date.now();
  const limit = options?.limit ?? 500;

  const staleReports = await db.select({ agentId: trustReports.agentId }).from(trustReports)
    .where(lt(trustReports.expiresAt, new Date()))
    .limit(limit);

  let recompiled = 0;
  for (const { agentId } of staleReports) {
    try {
      await compileAndCacheReport(agentId);
      recompiled++;
    } catch (err) {
      log(`Failed to recompile report for ${agentId}: ${(err as Error).message}`, "trust-report");
    }
  }

  const elapsed = Date.now() - start;
  if (recompiled > 0) {
    log(`Recompiled ${recompiled} trust reports in ${(elapsed / 1000).toFixed(1)}s`, "trust-report");
  }
  return { recompiled, elapsed };
}

/**
 * Get usage stats for the trust data product.
 */
export async function getReportUsageStats(): Promise<{
  totalReports: number;
  quickCheckAccess: number;
  fullReportAccess: number;
  verdictDistribution: Record<string, number>;
}> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_reports,
        COALESCE(SUM(quick_check_access_count), 0)::int as quick_access,
        COALESCE(SUM(full_report_access_count), 0)::int as full_access
      FROM trust_reports
    `);
    const row = (result as any).rows?.[0] ?? {};

    const verdictResult = await db.execute(sql`
      SELECT verdict, COUNT(*)::int as cnt
      FROM trust_reports
      GROUP BY verdict
    `);
    const verdictDistribution: Record<string, number> = {};
    for (const r of (verdictResult as any).rows ?? []) {
      verdictDistribution[r.verdict] = Number(r.cnt);
    }

    return {
      totalReports: Number(row.total_reports ?? 0),
      quickCheckAccess: Number(row.quick_access ?? 0),
      fullReportAccess: Number(row.full_access ?? 0),
      verdictDistribution,
    };
  } catch {
    return { totalReports: 0, quickCheckAccess: 0, fullReportAccess: 0, verdictDistribution: {} };
  }
}
