import { computeVerdict, type Verdict } from "../trust-report-compiler.js";
import { deriveCategoryStrengths } from "../trust-categories.js";

/**
 * Public-facing verdict union. The 5-tier v2 `Verdict` plus `"UNKNOWN"` for
 * the unscored-agent case (where we have no trust_score at all yet).
 */
export type PublicVerdict = Verdict | "UNKNOWN";

/** Null-safe wrapper around computeVerdict — returns UNKNOWN for unscored agents. */
export function verdictFor(
  score: number | null,
  tier: string | null,
  flags: string[] | null,
  status: string | null,
): PublicVerdict {
  if (score == null) return "UNKNOWN";
  return computeVerdict({
    score,
    qualityTier: tier,
    spamFlags: flags,
    lifecycleStatus: status,
  });
}

/**
 * Redact trust-intelligence fields for public responses. Keeps the aggregate
 * `trustScore` (needed to render the leaderboard stamp); strips the breakdown,
 * quality tier, spam flags, lifecycle status, and sybil signals. Derives
 * `categoryStrengths` from the breakdown before discarding it (qualitative
 * safe for free tier).
 */
export function redactAgentForPublic(agent: Record<string, unknown>): Record<string, unknown> {
  const verdict = verdictFor(
    agent.trustScore as number | null,
    (agent.qualityTier as string) ?? null,
    (agent.spamFlags as string[]) ?? null,
    (agent.lifecycleStatus as string) ?? null,
  );
  const categoryStrengths = agent.trustScoreBreakdown
    ? deriveCategoryStrengths(agent.trustScoreBreakdown as any, (agent.sybilRiskScore as number) ?? 0)
    : null;
  const {
    trustScoreBreakdown: _tsb,
    trustScoreUpdatedAt: _tsu,
    qualityTier: _qt,
    spamFlags: _sf,
    lifecycleStatus: _ls,
    sybilRiskScore: _srs,
    sybilSignals: _ss,
    ...publicFields
  } = agent;
  return {
    ...publicFields,
    verdict,
    categoryStrengths,
    reportAvailable: true,
    // AgentCard reads trustScoreForStamp; map from trustScore so /api/agents renders scores.
    trustScoreForStamp: (agent.trustScore as number | null) ?? null,
  };
}

// Lightweight in-memory TTL cache for expensive query results.
// Serverless functions are ephemeral, so memory is naturally bounded.
export const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > now) return entry.data as T;
  const data = await fn();
  responseCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

export function parseChainId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = parseInt(raw as string, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const ANALYTICS_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
export const ANALYTICS_TTL = 300_000;
