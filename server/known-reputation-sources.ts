// =============================================================================
// NOT READY — All features in this file are DISABLED pending real oracle addresses.
//
// Status as of March 2026:
// - KNOWN_SOURCES uses placeholder addresses (0x...aaaa, 0x...bbbb) — will never match real data
// - ACP badge (detectAcpAgent) is disabled in routes.ts — not returned in API responses
// - Source attribution UI is dormant — will only activate when real addresses are added
// - Sybil detection is dormant — requires FeedbackPosted events (zero in DB currently)
// - /api/reputation-sources returns {} until real addresses are configured
//
// To re-enable:
// 1. Get real oracle addresses from Virtuals ACP and bond.credit
// 2. Replace placeholder addresses in KNOWN_SOURCES below
// 3. Re-enable detectAcpAgent() call in server/routes.ts feedback endpoint
// 4. Re-enable ACP badge in client/src/pages/agent-profile.tsx header
// 5. Switch /api/reputation-sources back to return getAllKnownSources()
// =============================================================================

export interface ReputationSource {
  id: string;
  name: string;
  shortName: string;
  description: string;
  url: string;
  color: string;
  type: "commerce" | "credit" | "validation" | "community";
  trustLevel: "high" | "medium" | "community";
}

// PLACEHOLDER addresses — replace with real oracle addresses when confirmed
const KNOWN_SOURCES: Record<string, ReputationSource> = {
  "0x000000000000000000000000000000000000aaaa": { // PLACEHOLDER — not the real ACP oracle address
    id: "acp",
    name: "Virtuals ACP",
    shortName: "ACP",
    description: "Verified commerce rating from Virtuals Agent Commerce Protocol. This agent completed a job and was evaluated by a third-party evaluator.",
    url: "https://virtuals.io",
    color: "emerald",
    type: "commerce",
    trustLevel: "high",
  },
  "0x000000000000000000000000000000000000bbbb": { // PLACEHOLDER — not the real bond.credit oracle address
    id: "bond_credit",
    name: "bond.credit",
    shortName: "bond",
    description: "Professional credit score from bond.credit. Focuses on agent stability, predictability, and risk profile — not peak performance.",
    url: "https://bond.credit",
    color: "blue",
    type: "credit",
    trustLevel: "high",
  },
};

const ACP_KEYWORD_PATTERNS: RegExp[] = [
  /\bvirtuals?\b/,
  /\bacp\b/,
  /\bagent\s+commerce\b/,
  /\bfeai\b/,
  /\bg\.a\.m\.e\b/,
  /\bgame\s+framework\b/,
];

const ACP_CONTROLLER_PREFIXES: string[] = [];

export function getReputationSource(reviewerAddress: string): ReputationSource | null {
  const normalized = reviewerAddress.toLowerCase();
  return KNOWN_SOURCES[normalized] ?? null;
}

export function isKnownReviewer(reviewerAddress: string): boolean {
  return reviewerAddress.toLowerCase() in KNOWN_SOURCES;
}

export function registerReputationSource(address: string, source: ReputationSource): void {
  KNOWN_SOURCES[address.toLowerCase()] = source;
}

export function getAllKnownSources(): Record<string, ReputationSource> {
  return { ...KNOWN_SOURCES };
}

export function detectAcpAgent(agent: {
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  capabilities?: string[] | null;
  controllerAddress?: string | null;
}): boolean {
  const searchText = [
    agent.name ?? "",
    agent.description ?? "",
    ...(agent.tags ?? []),
    ...(agent.capabilities ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (ACP_KEYWORD_PATTERNS.some((pattern) => pattern.test(searchText))) {
    return true;
  }

  if (agent.controllerAddress) {
    const controller = agent.controllerAddress.toLowerCase();
    if (ACP_CONTROLLER_PREFIXES.some((prefix) => controller.startsWith(prefix))) {
      return true;
    }
  }

  return false;
}

export function detectSybilFlags(
  events: Array<{
    rawData: unknown;
    agentId: string;
    blockNumber: number;
  }>,
  agentControllerAddress: string | null | undefined
): Array<{ type: string; description: string; severity: "warning" | "critical" }> {
  const flags: Array<{ type: string; description: string; severity: "warning" | "critical" }> = [];

  const reviewerCounts: Record<string, number> = {};
  const controller = agentControllerAddress?.toLowerCase();

  for (const ev of events) {
    const data = ev.rawData as Record<string, unknown> | null;
    if (!data || typeof data !== "object") continue;

    const reviewer = typeof data.reviewer === "string" ? data.reviewer.toLowerCase() : null;
    if (!reviewer) continue;

    reviewerCounts[reviewer] = (reviewerCounts[reviewer] ?? 0) + 1;

    if (controller && reviewer === controller) {
      flags.push({
        type: "self_feedback",
        description: "This agent's controller address submitted feedback on itself.",
        severity: "critical",
      });
    }
  }

  for (const [reviewer, count] of Object.entries(reviewerCounts)) {
    if (count >= 3 && !isKnownReviewer(reviewer)) {
      flags.push({
        type: "repeated_reviewer",
        description: `The same address (${reviewer.slice(0, 6)}…${reviewer.slice(-4)}) submitted ${count} feedback events.`,
        severity: "warning",
      });
    }
  }

  const unknownReviewerCount = Object.entries(reviewerCounts).filter(
    ([addr]) => !isKnownReviewer(addr)
  ).length;
  const totalReviewers = Object.keys(reviewerCounts).length;
  if (totalReviewers > 0 && unknownReviewerCount === totalReviewers && events.length > 5) {
    const burstWindow = 100;
    const blockNumbers = events.map((e) => e.blockNumber);
    const firstBlock = Math.min(...blockNumbers);
    const lastBlock = Math.max(...blockNumbers);
    if (lastBlock - firstBlock < burstWindow && events.length >= 5) {
      flags.push({
        type: "burst_pattern",
        description: `${events.length} feedback events were submitted within ${lastBlock - firstBlock} blocks — possible coordinated inflation.`,
        severity: "warning",
      });
    }
  }

  return flags;
}
