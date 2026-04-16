import type { TrustScoreBreakdown } from "./trust-score.js";

export type StrengthTier = "high" | "medium" | "low" | "none";

export interface CategoryStrengths {
  identity: StrengthTier;
  behavioral: StrengthTier;
  community: StrengthTier;
  authenticity: StrengthTier;
  attestation: StrengthTier;
}

/**
 * Percent thresholds for the qualitative strength tiers. Exported so the
 * frontend `<CategoryBars />` component can size visual bars using the same
 * boundaries and avoid silent drift from the backend bucketing.
 */
export const STRENGTH_THRESHOLDS = { HIGH: 70, MEDIUM: 40, LOW: 1 } as const;

function bucket(percent: number): StrengthTier {
  if (percent >= STRENGTH_THRESHOLDS.HIGH) return "high";
  if (percent >= STRENGTH_THRESHOLDS.MEDIUM) return "medium";
  if (percent >= STRENGTH_THRESHOLDS.LOW) return "low";
  return "none";
}

/**
 * Map `sybilRiskScore` (0–1 float from `computeSybilRiskScore()`) to an
 * inverse-authenticity tier. 0 risk = high authenticity; higher risk = lower
 * authenticity. Boundaries chosen so a single "low" sybil signal (0.15) lands
 * in medium, a "medium" signal (0.30) drops to low, and a "high" signal
 * (0.50+) lands at none.
 */
function authenticityTier(sybilRiskScore: number | null): StrengthTier {
  const risk = sybilRiskScore ?? 0;
  if (risk === 0) return "high";
  if (risk < 0.3) return "medium";
  if (risk < 0.6) return "low";
  return "none";
}

/**
 * Map internal 5-category numeric breakdown to the 5 public-facing strength
 * tiers. Raw numeric scores stay gated behind the $0.05 Full Report — this
 * helper produces the free-tier qualitative view.
 *
 * Public category mapping:
 *   identity       ← profile   / 15
 *   behavioral     ← (transactions + longevity) / 50
 *   community      ← community / 10
 *   authenticity   ← inverted sybilRiskScore (0–1 float: 0 = high authenticity)
 *   attestation    ← reputation / 25  (always 'none' in v2, pipeline inactive)
 */
export function deriveCategoryStrengths(
  breakdown: TrustScoreBreakdown,
  sybilRiskScore: number | null,
): CategoryStrengths {
  const c = breakdown.categories;
  const identityPct = (c.profile / 15) * 100;
  const behavioralPct = ((c.transactions + c.longevity) / 50) * 100;
  const communityPct = (c.community / 10) * 100;
  const attestationPct = (c.reputation / 25) * 100;

  return {
    identity: bucket(identityPct),
    behavioral: bucket(behavioralPct),
    community: bucket(communityPct),
    authenticity: authenticityTier(sybilRiskScore),
    attestation: bucket(attestationPct),
  };
}
