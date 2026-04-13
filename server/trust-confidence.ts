/**
 * Confidence level computation for trust scores.
 *
 * Implements Principle 1 (Epistemic Honesty) and Principle 11 (Multi-Source Verification).
 * Reflects how many independent data sources back the trust score and whether any
 * consistency signals suggest the data may be misleading.
 */

export interface ConfidenceInput {
  /** Agent has identity metadata (name, description, etc.) */
  hasIdentity: boolean;
  /** x402 probes have been run against the agent's endpoints */
  hasProbes: boolean;
  /** On-chain transactions are present for this agent */
  hasTransactions: boolean;
  /** GitHub health data is available */
  hasGithub: boolean;
  /** Farcaster presence data is available */
  hasFarcaster: boolean;
}

export interface ConsistencyFlags {
  /** Agent claims x402 support but has no transaction history */
  x402ActiveButNoTransactions?: boolean;
  /** Agent declares endpoints but all probes failed */
  endpointsDeclaredButAllFail?: boolean;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "minimal";

export interface ConfidenceResult {
  /** Qualitative confidence level */
  level: ConfidenceLevel;
  /** Weighted score in [0, 1] after consistency penalties */
  score: number;
  /** Number of active data sources */
  sourcesActive: number;
  /** Total number of data sources considered */
  sourcesTotal: number;
  /** Labels of inactive/missing sources */
  missing: string[];
  /** Detected consistency issues */
  flags: string[];
}

/** Source weights must sum to 1.0 */
const SOURCE_WEIGHTS: Array<{ key: keyof ConfidenceInput; label: string; weight: number }> = [
  { key: "hasIdentity", label: "identity", weight: 0.30 },
  { key: "hasTransactions", label: "transactions", weight: 0.20 },
  { key: "hasGithub", label: "github", weight: 0.20 },
  { key: "hasProbes", label: "x402_probes", weight: 0.15 },
  { key: "hasFarcaster", label: "farcaster", weight: 0.15 },
];

const CONSISTENCY_PENALTY = 0.05;

/**
 * Compute a confidence result from available data sources and optional consistency flags.
 *
 * @param input - Which data sources are active for this agent
 * @param consistency - Optional flags indicating data inconsistencies
 */
export function computeConfidence(
  input: ConfidenceInput,
  consistency?: ConsistencyFlags,
): ConfidenceResult {
  const missing: string[] = [];
  let weightedScore = 0;
  let sourcesActive = 0;

  for (const source of SOURCE_WEIGHTS) {
    if (input[source.key]) {
      weightedScore += source.weight;
      sourcesActive++;
    } else {
      missing.push(source.label);
    }
  }

  // Apply consistency penalties
  const flags: string[] = [];
  if (consistency?.x402ActiveButNoTransactions) {
    flags.push("x402_claimed_no_transactions");
  }
  if (consistency?.endpointsDeclaredButAllFail) {
    flags.push("endpoints_unreachable");
  }

  const penalizedScore = Math.max(0, weightedScore - flags.length * CONSISTENCY_PENALTY);

  // Determine level from penalized score
  let level: ConfidenceLevel;
  if (penalizedScore >= 0.7) {
    level = "high";
  } else if (penalizedScore >= 0.45) {
    level = "medium";
  } else if (penalizedScore >= 0.2) {
    level = "low";
  } else {
    level = "minimal";
  }

  return {
    level,
    score: penalizedScore,
    sourcesActive,
    sourcesTotal: SOURCE_WEIGHTS.length,
    missing,
    flags,
  };
}
