import {
  type Agent,
  type CommunityFeedbackSummary,
  type X402Probe,
  type TrustReport,
  agents,
  trustAnchors,
  trustReports,
  x402Probes,
} from "../shared/schema.js";
import { CHAIN_CONFIGS } from "../shared/chains.js";
import { type TrustScoreBreakdown, calculateTrustScore } from "./trust-score.js";
import { computeConfidence } from "./trust-confidence.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { eq, sql, lt, and } from "drizzle-orm";
import { log } from "./lib/log.js";

// --- Types ---

export type Verdict = "TRUSTED" | "CAUTION" | "UNTRUSTED" | "UNKNOWN";

export interface QuickCheckData {
  address: string;
  chainId: number | null;
  name: string | null;
  verdict: Verdict;
  score: number;
  scoreBreakdown: TrustScoreBreakdown;
  tier: string;
  flags: string[];
  x402Active: boolean;
  ageInDays: number;
  crossChainPresence: number;
  transactionCount: number;
  reportAvailable: boolean;
  generatedAt: string;
  reportVersion: number;
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
  trust: {
    verdict: Verdict;
    score: number;
    breakdown: TrustScoreBreakdown;
    tier: string;
    flags: string[];
    lifecycleStatus: string;
    updatedAt: string | null;
    signalHash: string | null;
    methodologyVersion: number;
    confidence: {
      level: string;
      score: number;
      sourcesActive: number;
      sourcesTotal: number;
      missing: string[];
      flags: string[];
    };
  };
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
  provenance: {
    signalHash: string | null;
    methodologyVersion: number;
    scoredAt: string | null;
    disclaimer: string;
    anchor: {
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
    } | null;
  };
  sybil: {
    signals: Array<{ type: string; severity: string; detail: string; value: number }>;
    riskScore: number;
    dampeningApplied: boolean;
    rawScoreBeforeDampening: number | null;
  } | null;
}

const REPORT_VERSION = 2;
const REPORT_TTL_MS = 60 * 60 * 1000; // 1 hour

// --- Verdict Logic ---

export function computeVerdict(
  score: number,
  tier: string | null,
  spamFlags: string[] | null,
  lifecycleStatus: string | null,
): Verdict {
  const flags = spamFlags ?? [];
  const status = lifecycleStatus ?? "active";

  // Hard untrusted conditions
  if (tier === "spam" || tier === "archived") return "UNTRUSTED";
  if (status === "archived") return "UNTRUSTED";
  if (score < 30) return "UNTRUSTED";

  // Trusted: high/medium tier, good score, no flags
  if (score >= 60 && (tier === "high" || tier === "medium") && flags.length === 0) {
    return "TRUSTED";
  }

  // Everything else is caution
  return "CAUTION";
}

// --- Data Fetching Helpers ---

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

async function getAgentTransactionStats(agentId: string): Promise<{
  count: number;
  totalVolumeUsd: number;
  topTokens: Array<{ symbol: string; count: number; volumeUsd: number }>;
  lastTxAt: string | null;
}> {
  try {
    // Single query: aggregate stats + per-token breakdown + last timestamp
    const result = await db.execute(sql`
      WITH stats AS (
        SELECT
          COUNT(*)::int as total_count,
          COALESCE(SUM(amount_usd), 0)::float as total_volume_usd,
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
        s.total_count, s.total_volume_usd, s.last_tx_at,
        COALESCE(json_agg(json_build_object(
          'symbol', t.token_symbol, 'count', t.count, 'volumeUsd', t.volume_usd
        )) FILTER (WHERE t.token_symbol IS NOT NULL), '[]') as top_tokens
      FROM stats s LEFT JOIN tokens t ON true
      GROUP BY s.total_count, s.total_volume_usd, s.last_tx_at
    `);
    const row = (result as any).rows?.[0];
    if (!row) return { count: 0, totalVolumeUsd: 0, topTokens: [], lastTxAt: null };

    return {
      count: Number(row.total_count ?? 0),
      totalVolumeUsd: Number(row.total_volume_usd ?? 0),
      topTokens: (typeof row.top_tokens === "string" ? JSON.parse(row.top_tokens) : row.top_tokens) ?? [],
      lastTxAt: row.last_tx_at?.toISOString?.() ?? (row.last_tx_at ? String(row.last_tx_at) : null),
    };
  } catch {
    return { count: 0, totalVolumeUsd: 0, topTokens: [], lastTxAt: null };
  }
}

// --- Compilers ---

export function compileQuickCheck(
  agent: Agent,
  breakdown: TrustScoreBreakdown,
  crossChainData: { count: number },
  txStats: { count: number },
  verdict: Verdict,
): QuickCheckData {
  const ageDays = Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return {
    address: agent.primaryContractAddress,
    chainId: agent.chainId,
    name: agent.name,
    verdict,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    tier: agent.qualityTier ?? "unclassified",
    flags: agent.spamFlags ?? [],
    x402Active: agent.x402Support === true,
    ageInDays: ageDays,
    crossChainPresence: crossChainData.count,
    transactionCount: txStats.count,
    reportAvailable: true,
    generatedAt: new Date().toISOString(),
    reportVersion: REPORT_VERSION,
  };
}

export function compileFullReport(
  agent: Agent,
  breakdown: TrustScoreBreakdown,
  crossChainData: { count: number; chains: Array<{ chainId: number; name: string; firstSeenBlock: number }> },
  eventCount: number,
  probes: X402Probe[],
  txStats: { count: number; totalVolumeUsd: number; topTokens: Array<{ symbol: string; count: number; volumeUsd: number }>; lastTxAt: string | null },
  feedback: CommunityFeedbackSummary | null,
  verdict: Verdict,
): FullReportData {
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

  // Extract endpoints as array
  let endpointList: any[] = [];
  if (agent.endpoints) {
    if (Array.isArray(agent.endpoints)) endpointList = agent.endpoints;
    else if (typeof agent.endpoints === "object") {
      endpointList = Object.entries(agent.endpoints as Record<string, any>).map(([name, url]) => ({
        name,
        url: typeof url === "string" ? url : JSON.stringify(url),
      }));
    }
  }

  const hasEndpoints = endpointList.length > 0;
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
    trust: {
      verdict,
      score: breakdown.total,
      breakdown,
      tier: agent.qualityTier ?? "unclassified",
      flags: agent.spamFlags ?? [],
      lifecycleStatus: agent.lifecycleStatus ?? "active",
      updatedAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
      signalHash: agent.trustSignalHash ?? null,
      methodologyVersion: agent.trustMethodologyVersion ?? 1,
      confidence: computeConfidence({
        hasIdentity: !!(agent.name && agent.name.trim().length > 0),
        hasProbes: probes.length > 0,
        hasTransactions: txStats.count > 0,
        hasGithub: (feedback?.githubHealthScore ?? 0) > 0,
        hasFarcaster: (feedback?.farcasterScore ?? 0) > 0,
      }, {
        x402ActiveButNoTransactions: agent.x402Support === true && txStats.count === 0,
        endpointsDeclaredButAllFail: !!hasEndpoints && probes.length > 0 && probes.every(p => p.probeStatus !== "success"),
      }),
    },
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
      transactionCount: txStats.count,
      totalVolumeUsd: txStats.totalVolumeUsd,
      topTokens: txStats.topTokens,
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
        transactions: txStats.lastTxAt,
        community: feedback?.lastUpdatedAt?.toISOString() ?? null,
      },
    },
    provenance: {
      signalHash: agent.trustSignalHash ?? null,
      methodologyVersion: agent.trustMethodologyVersion ?? 1,
      scoredAt: agent.trustScoreUpdatedAt?.toISOString() ?? null,
      disclaimer: "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.",
      anchor: null,
    },
    sybil: agent.sybilSignals ? {
      signals: agent.sybilSignals as any[],
      riskScore: agent.sybilRiskScore ?? 0,
      dampeningApplied: (agent.sybilRiskScore ?? 0) > 0,
      rawScoreBeforeDampening: (agent.sybilRiskScore ?? 0) > 0
        ? Math.round(breakdown.total / (1.0 - ((agent.sybilRiskScore ?? 0) * 0.5)))
        : null,
    } : null,
  };
}

// --- Core Operations ---

/**
 * Compile and cache a trust report for a given agent.
 * Fetches all required data, compiles both tiers, and upserts into trust_reports.
 */
export async function compileAndCacheReport(agentId: string): Promise<TrustReport | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;

  // Fetch all data in parallel
  const [crossChainData, eventCount, probes, txStats, feedback, anchorRow] = await Promise.all([
    getAgentCrossChainData(agent.controllerAddress),
    getAgentEventCount(agentId),
    getAgentProbes(agentId),
    getAgentTransactionStats(agentId),
    storage.getCommunityFeedbackSummary(agentId).catch(() => null),
    db.select().from(trustAnchors).where(eq(trustAnchors.agentId, agentId)).limit(1)
      .then(rows => rows[0] ?? null)
      .catch(() => null),
  ]);

  const rawBreakdown = calculateTrustScore(agent, feedback, eventCount, crossChainData.count);

  // Apply sybil dampening (matches recalculateAllScores pipeline)
  const { computeDampeningMultiplier } = await import("./sybil-detection.js");
  const sybilMultiplier = computeDampeningMultiplier(agent.sybilRiskScore ?? 0);
  const dampenedTotal = Math.round(rawBreakdown.total * sybilMultiplier);
  const breakdown = { ...rawBreakdown, total: dampenedTotal };

  const verdict = computeVerdict(breakdown.total, agent.qualityTier, agent.spamFlags, agent.lifecycleStatus);

  const quickCheckData = compileQuickCheck(agent, breakdown, crossChainData, txStats, verdict);
  const fullReportData = compileFullReport(agent, breakdown, crossChainData, eventCount, probes, txStats, feedback, verdict);

  // Patch on-chain anchor proof into report (fetched in parallel above)
  if (anchorRow) {
    const trustRootAddress = process.env.TRUST_ROOT_ADDRESS ?? null;
    fullReportData.provenance.anchor = {
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

  // Upsert: one report per agent
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
      // Re-fetch via storage to get proper typed object
      return await storage.getAgent(rows[0].id);
    }
  } catch {}

  // 2. Payment address (from x402 probes)
  try {
    const probeResult = await db.select({ agentId: x402Probes.agentId }).from(x402Probes)
      .where(sql`LOWER(payment_address) = ${addr}`)
      .limit(1);
    if (probeResult.length > 0) {
      return await storage.getAgent(probeResult[0].agentId);
    }
  } catch {}

  return null;
}

/**
 * Get a cached report or compile on-demand if stale/missing.
 * Resolves the agent first (by any address type), then checks cache by agentId.
 * This ensures lookups by controller or payment address still hit the cache.
 */
export async function getOrCompileReport(address: string, chainId?: number): Promise<{
  report: TrustReport;
  compiled: boolean;
} | null> {
  // Resolve agent first — handles contract, controller, and payment addresses
  const agent = await resolveAgentByAddress(address, chainId);
  if (!agent) return null;

  // Check cache by agentId (unique index) — works regardless of which address was used for lookup
  try {
    const cached = await db.select().from(trustReports)
      .where(eq(trustReports.agentId, agent.id))
      .limit(1);

    if (cached.length > 0 && new Date(cached[0].expiresAt) > new Date()) {
      return { report: cached[0], compiled: false };
    }
  } catch {}

  // Compile and cache
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
 * Batch recompile reports for agents whose scores changed.
 * Called from Trigger.dev recalculate task.
 */
export async function batchRecompileReports(options?: { limit?: number }): Promise<{ recompiled: number; elapsed: number }> {
  const start = Date.now();
  const limit = options?.limit ?? 500;

  // Recompile reports that exist and are expired, or where score has changed
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
