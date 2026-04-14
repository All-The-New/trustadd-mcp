/**
 * Sybil Detection Module
 *
 * Detects Sybil operators via four signal types:
 * 1. Controller clustering — controllers with >10 agents
 * 2. Metadata fingerprint duplication — agents sharing fingerprints across controllers
 * 3. Self-referential payments — tx cycles between controlled wallets
 * 4. Temporal burst — >50% of tx volume in last 24h
 */

import { sql } from "drizzle-orm";

export interface SybilSignal {
  type: "controller_cluster" | "fingerprint_duplicate" | "self_referential_payment" | "temporal_burst";
  severity: "low" | "medium" | "high";
  detail: string;
  /** Numeric value driving severity (e.g. agent count, duplicate count) */
  value: number;
}

export interface SybilAnalysis {
  signals: SybilSignal[];
  riskScore: number;       // 0–1 (0 = no risk, 1 = certain Sybil)
  dampeningMultiplier: number; // 0.5–1.0 (applied to raw trust score)
}

/** Lookup maps pre-fetched for batch sybil detection. */
export interface SybilLookups {
  /** controller_address → count of agents they control */
  controllerAgentCounts: Map<string, number>;
  /** metadata_fingerprint → set of distinct controller_addresses sharing it */
  fingerprintControllers: Map<string, Set<string>>;
  /** agent_id → { selfReferentialCount, totalTxCount, recentTxRatio } */
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>;
}

/**
 * Detect controller clustering signal.
 * Threshold: >10 agents per controller.
 * Severity: low (11-50), medium (51-500), high (>500).
 */
export function detectControllerCluster(agentCount: number): SybilSignal | null {
  if (agentCount <= 10) return null;

  let severity: SybilSignal["severity"];
  if (agentCount > 500) severity = "high";
  else if (agentCount > 50) severity = "medium";
  else severity = "low";

  return {
    type: "controller_cluster",
    severity,
    detail: `Controller operates ${agentCount} agents`,
    value: agentCount,
  };
}

/**
 * Detect metadata fingerprint duplication signal.
 * Threshold: >1 controller sharing the same fingerprint.
 * Severity: low (2-5), medium (6-20), high (>20).
 */
export function detectFingerprintDuplicate(
  fingerprint: string | null,
  fingerprintControllers: Map<string, Set<string>>,
): SybilSignal | null {
  if (!fingerprint) return null;
  const controllers = fingerprintControllers.get(fingerprint);
  if (!controllers || controllers.size <= 1) return null;

  const count = controllers.size;
  let severity: SybilSignal["severity"];
  if (count > 20) severity = "high";
  else if (count > 5) severity = "medium";
  else severity = "low";

  return {
    type: "fingerprint_duplicate",
    severity,
    detail: `Metadata fingerprint shared by ${count} different controllers`,
    value: count,
  };
}

/**
 * Detect self-referential payment signal.
 * Threshold: any self-referential transactions exist.
 * Severity: medium (10-50% ratio), high (>50% ratio).
 */
export function detectSelfReferentialPayment(
  agentId: string,
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>,
): SybilSignal | null {
  const pattern = transactionPatterns.get(agentId);
  if (!pattern || pattern.selfRefCount === 0) return null;

  const ratio = pattern.selfRefCount / pattern.totalCount;
  let severity: SybilSignal["severity"];
  if (ratio > 0.5) severity = "high";
  else if (ratio >= 0.1) severity = "medium";
  else severity = "low";

  return {
    type: "self_referential_payment",
    severity,
    detail: `${pattern.selfRefCount}/${pattern.totalCount} transactions (${Math.round(ratio * 100)}%) are between controlled wallets`,
    value: pattern.selfRefCount,
  };
}

/**
 * Detect temporal burst signal.
 * Threshold: >=50% of tx volume in last 24h, min 5 total txns.
 * Severity: medium (50-80%), high (>80%).
 */
export function detectTemporalBurst(
  agentId: string,
  transactionPatterns: Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>,
): SybilSignal | null {
  const pattern = transactionPatterns.get(agentId);
  if (!pattern || pattern.totalCount < 5) return null;
  if (pattern.recentRatio < 0.5) return null;

  let severity: SybilSignal["severity"];
  if (pattern.recentRatio > 0.8) severity = "high";
  else severity = "medium";

  return {
    type: "temporal_burst",
    severity,
    detail: `${Math.round(pattern.recentRatio * 100)}% of transaction volume arrived in the last 24 hours`,
    value: Math.round(pattern.recentRatio * 100),
  };
}

const SEVERITY_WEIGHTS: Record<SybilSignal["severity"], number> = {
  low: 0.15,
  medium: 0.3,
  high: 0.5,
};

/**
 * Compute aggregate sybil risk score from detected signals.
 * Returns a value in [0, 1].
 */
export function computeSybilRiskScore(signals: SybilSignal[]): number {
  if (signals.length === 0) return 0;
  let score = 0;
  for (const signal of signals) {
    score += SEVERITY_WEIGHTS[signal.severity];
  }
  return Math.min(1.0, Math.round(score * 100) / 100);
}

/**
 * Compute dampening multiplier from risk score.
 * Maps [0, 1] risk score → [1.0, 0.5] multiplier.
 */
export function computeDampeningMultiplier(riskScore: number): number {
  const clamped = Math.max(0, Math.min(1, riskScore));
  return 1.0 - (clamped * 0.5);
}

/**
 * Orchestrate all sybil signal detectors for a single agent.
 * Pure function — requires pre-fetched lookups (no DB access).
 */
export function analyzeSybilSignals(
  agentId: string,
  controllerAddress: string,
  metadataFingerprint: string | null,
  lookups: SybilLookups,
): SybilAnalysis {
  const signals: SybilSignal[] = [];

  // 1. Controller clustering
  const agentCount = lookups.controllerAgentCounts.get(controllerAddress) ?? 0;
  const clusterSignal = detectControllerCluster(agentCount);
  if (clusterSignal) signals.push(clusterSignal);

  // 2. Fingerprint duplication
  const fpSignal = detectFingerprintDuplicate(metadataFingerprint, lookups.fingerprintControllers);
  if (fpSignal) signals.push(fpSignal);

  // 3. Self-referential payments
  const selfRefSignal = detectSelfReferentialPayment(agentId, lookups.transactionPatterns);
  if (selfRefSignal) signals.push(selfRefSignal);

  // 4. Temporal burst
  const burstSignal = detectTemporalBurst(agentId, lookups.transactionPatterns);
  if (burstSignal) signals.push(burstSignal);

  const riskScore = computeSybilRiskScore(signals);
  const dampeningMultiplier = computeDampeningMultiplier(riskScore);

  return { signals, riskScore, dampeningMultiplier };
}

/**
 * Prefetch all lookup maps needed for batch sybil detection.
 * Runs 3 SQL queries — must be called with an active DB connection.
 */
export async function prefetchSybilLookups(db: any): Promise<SybilLookups> {
  // 1. Controller agent counts (only controllers with >10 agents)
  const controllerAgentCounts = new Map<string, number>();
  try {
    const result = await db.execute(sql`
      SELECT controller_address, COUNT(*)::int AS cnt
      FROM agents
      WHERE controller_address IS NOT NULL AND controller_address != ''
      GROUP BY controller_address
      HAVING COUNT(*) > 10
    `);
    for (const row of (result as any).rows ?? []) {
      controllerAgentCounts.set(row.controller_address, row.cnt);
    }
  } catch (e) { console.error("[sybil] controller count query failed:", (e as Error).message); }

  // 2. Fingerprint → set of controllers sharing it
  const fingerprintControllers = new Map<string, Set<string>>();
  try {
    const result = await db.execute(sql`
      SELECT metadata_fingerprint, controller_address
      FROM agents
      WHERE metadata_fingerprint IS NOT NULL AND metadata_fingerprint != ''
        AND controller_address IS NOT NULL AND controller_address != ''
      GROUP BY metadata_fingerprint, controller_address
    `);
    for (const row of (result as any).rows ?? []) {
      const fp = row.metadata_fingerprint;
      if (!fingerprintControllers.has(fp)) {
        fingerprintControllers.set(fp, new Set());
      }
      fingerprintControllers.get(fp)!.add(row.controller_address);
    }
    // Remove entries with only 1 controller (not duplicated)
    for (const [fp, controllers] of fingerprintControllers) {
      if (controllers.size <= 1) fingerprintControllers.delete(fp);
    }
  } catch (e) { console.error("[sybil] fingerprint query failed:", (e as Error).message); }

  // 3. Transaction patterns per agent (self-referential + temporal burst)
  const transactionPatterns = new Map<string, { selfRefCount: number; totalCount: number; recentRatio: number }>();
  try {
    const result = await db.execute(sql`
      WITH agent_controllers AS (
        SELECT id AS agent_id, controller_address FROM agents
        WHERE controller_address IS NOT NULL
      ),
      tx_stats AS (
        SELECT
          t.agent_id,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (
            WHERE t.from_address = ac.controller_address
               OR t.to_address = ac.controller_address
          )::int AS self_ref_count,
          COUNT(*) FILTER (
            WHERE t.block_timestamp > NOW() - INTERVAL '24 hours'
          )::int AS recent_count
        FROM agent_transactions t
        JOIN agent_controllers ac ON ac.agent_id = t.agent_id
        GROUP BY t.agent_id, ac.controller_address
      )
      SELECT agent_id, total_count, self_ref_count,
             CASE WHEN total_count > 0
               THEN ROUND(recent_count::numeric / total_count, 2)
               ELSE 0
             END AS recent_ratio
      FROM tx_stats
      WHERE total_count > 0
    `);
    for (const row of (result as any).rows ?? []) {
      transactionPatterns.set(row.agent_id, {
        selfRefCount: Number(row.self_ref_count),
        totalCount: Number(row.total_count),
        recentRatio: Number(row.recent_ratio),
      });
    }
  } catch (e) { console.error("[sybil] transaction pattern query failed:", (e as Error).message); }

  return { controllerAgentCounts, fingerprintControllers, transactionPatterns };
}
