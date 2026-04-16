import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CheckCircle, TrendingUp, CircleDot, AlertTriangle, HelpCircle } from "lucide-react";

export type Verdict = "VERIFIED" | "TRUSTED" | "BUILDING" | "INSUFFICIENT" | "FLAGGED";
export type PublicVerdict = Verdict | "UNKNOWN";

export interface VerdictDescriptor {
  tier: Verdict;
  label: string;        // display name used in stamps/chips
  shortLabel: string;   // space-constrained uppercase label, e.g. "FLAG"
  color: string;        // primary tier color (hex)
  tintBg: string;       // translucent bg for the tier-tint info block
  icon: LucideIcon;
  minScore: number;
  maxScore: number;
}

const VERIFIED: VerdictDescriptor = {
  tier: "VERIFIED", label: "VERIFIED", shortLabel: "VERIFIED",
  color: "#10b981", tintBg: "rgba(16, 185, 129, 0.14)",
  icon: BadgeCheck, minScore: 80, maxScore: 100,
};
const TRUSTED: VerdictDescriptor = {
  tier: "TRUSTED", label: "TRUSTED", shortLabel: "TRUSTED",
  color: "#22c55e", tintBg: "rgba(34, 197, 94, 0.14)",
  icon: CheckCircle, minScore: 60, maxScore: 79,
};
// BUILDING floor temporarily 20 (see computeVerdict JSDoc, raise with v3).
const BUILDING: VerdictDescriptor = {
  tier: "BUILDING", label: "BUILDING", shortLabel: "BUILDING",
  color: "#3b82f6", tintBg: "rgba(59, 130, 246, 0.14)",
  icon: TrendingUp, minScore: 20, maxScore: 59,
};
const INSUFFICIENT: VerdictDescriptor = {
  tier: "INSUFFICIENT", label: "INSUFFICIENT", shortLabel: "INSUFF",
  color: "#a1a1aa", tintBg: "rgba(161, 161, 170, 0.14)",
  icon: CircleDot, minScore: 0, maxScore: 19,
};
const FLAGGED: VerdictDescriptor = {
  tier: "FLAGGED", label: "FLAGGED", shortLabel: "FLAG",
  color: "#ef4444", tintBg: "rgba(239, 68, 68, 0.14)",
  icon: AlertTriangle, minScore: 0, maxScore: 100,
};

const BY_TIER: Record<Verdict, VerdictDescriptor> = {
  VERIFIED, TRUSTED, BUILDING, INSUFFICIENT, FLAGGED,
};

/** Resolve a descriptor for a verdict. Treats UNKNOWN + null as INSUFFICIENT (UI-only). */
export function verdictDescriptor(verdict: PublicVerdict | null | undefined): VerdictDescriptor {
  if (!verdict || verdict === "UNKNOWN") return INSUFFICIENT;
  return BY_TIER[verdict];
}

/** Helper icon for the API-level UNKNOWN tier — UI never renders this, but Trust API page does. */
export const UNKNOWN_ICON = HelpCircle;

/** All five visible descriptors, in display order (low → high, for distribution strips). */
export const TIER_ORDER: VerdictDescriptor[] = [FLAGGED, INSUFFICIENT, BUILDING, TRUSTED, VERIFIED];
