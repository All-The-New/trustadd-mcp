/**
 * Trust Verifications — Layer 2 (v2 methodology).
 *
 * Verifications are binary achievements that recognize qualitative milestones.
 * They do NOT affect the 0–100 trust score; they sit alongside the score as
 * a distinct signal surface for the UI.
 *
 * The `name` and `description` strings below MUST stay in lockstep with the
 * VERIFICATIONS array in client/src/pages/methodology.tsx so the dashboard,
 * methodology page, and agent detail page all show the same copy.
 */

import type { Agent } from "../shared/schema.js";
import type { TxStats, ProbeStats } from "./trust-score.js";

export interface Verification {
  name: string;
  earned: boolean;
  description: string;
}

export interface VerificationsInput {
  agent: Agent;
  txStats: TxStats;
  probeStats: ProbeStats;
  feedback: {
    githubHealthScore?: number | null;
    farcasterScore?: number | null;
  } | null | undefined;
  metadataEventCount: number;
  chainPresence: number;
}

/** Early-adopter cutoff — must match EARLY_ADOPTER_CUTOFF in trust-score.ts. */
const EARLY_ADOPTER_CUTOFF = new Date("2026-06-01T00:00:00Z");

/** Active-maintainer thresholds — must match trust-score.ts constants. */
const ACTIVE_MAINTAINER_MIN_EVENTS = 3;
const ACTIVE_MAINTAINER_MIN_AGE_DAYS = 90;

/**
 * Compute the full set of 9 verifications for an agent.
 *
 * Returns all 9 every time (earned + unearned) so the UI can render the
 * "not yet earned" state consistently.
 */
export function computeVerifications(input: VerificationsInput): Verification[] {
  const { agent, txStats, probeStats, feedback, metadataEventCount, chainPresence } = input;

  const ageDays =
    (Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const metadataUri = agent.metadataUri ?? "";

  const verifications: Verification[] = [
    {
      name: "Multi-Chain",
      earned: chainPresence >= 3,
      description: "Registered on 3+ chains",
    },
    {
      name: "x402 Enabled",
      earned: probeStats.hasLive402,
      description: "x402 endpoint detected and responsive",
    },
    {
      name: "GitHub Connected",
      earned: (feedback?.githubHealthScore ?? 0) > 0,
      description: "Linked GitHub project with health data",
    },
    {
      name: "Farcaster Connected",
      earned: (feedback?.farcasterScore ?? 0) > 0,
      description: "Farcaster social presence detected",
    },
    {
      name: "IPFS Metadata",
      earned: metadataUri.startsWith("ipfs://") || metadataUri.startsWith("ar://"),
      description: "Metadata on IPFS or Arweave",
    },
    {
      name: "OASF Skills",
      earned:
        (agent.oasfSkills?.length ?? 0) > 0 ||
        (agent.oasfDomains?.length ?? 0) > 0,
      description: "Declared OASF skills/capabilities",
    },
    {
      name: "Early Adopter",
      earned: new Date(agent.createdAt) < EARLY_ADOPTER_CUTOFF,
      description: "Registered before June 2026",
    },
    {
      name: "Active Maintainer",
      earned:
        metadataEventCount >= ACTIVE_MAINTAINER_MIN_EVENTS &&
        ageDays >= ACTIVE_MAINTAINER_MIN_AGE_DAYS,
      description: "Regular updates over 90+ days",
    },
    {
      name: "First Transaction",
      earned: txStats.txCount >= 1,
      description: "At least one verified payment received",
    },
  ];

  return verifications;
}
