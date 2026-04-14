import { computeVerdict, type Verdict } from "../trust-report-compiler.js";

/** Null-safe wrapper around computeVerdict — returns UNKNOWN for unscored agents. */
export function verdictFor(
  score: number | null,
  tier: string | null,
  flags: string[] | null,
  status: string | null,
): Verdict {
  return score == null ? "UNKNOWN" : computeVerdict(score, tier, flags, status);
}

/** Strip trust-intelligence fields from an agent object for public (free) responses. */
export function redactAgentForPublic(agent: Record<string, unknown>): Record<string, unknown> {
  const verdict = verdictFor(
    agent.trustScore as number | null,
    (agent.qualityTier as string) ?? null,
    (agent.spamFlags as string[]) ?? null,
    (agent.lifecycleStatus as string) ?? null,
  );
  const {
    trustScore: _ts,
    trustScoreBreakdown: _tsb,
    trustScoreUpdatedAt: _tsu,
    qualityTier: _qt,
    spamFlags: _sf,
    lifecycleStatus: _ls,
    ...publicFields
  } = agent;
  return {
    ...publicFields,
    verdict,
    reportAvailable: true,
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
