/**
 * Sybil Detection Module
 *
 * Detects Sybil operators via four signal types:
 * 1. Controller clustering — controllers with >10 agents
 * 2. Metadata fingerprint duplication — agents sharing fingerprints across controllers
 * 3. Self-referential payments — tx cycles between controlled wallets
 * 4. Temporal burst — >50% of tx volume in last 24h
 */

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
