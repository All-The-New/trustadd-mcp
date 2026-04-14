/**
 * Deterministic agent fixtures for trust score and verdict testing.
 * These represent known agent profiles with predictable scoring outcomes.
 */
import type { Agent, CommunityFeedbackSummary } from "../../shared/schema.js";

/** Minimal valid agent with only required fields populated. */
function baseAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test-agent-1",
    erc8004Id: "42",
    chainId: 8453,
    primaryContractAddress: "0x1234567890abcdef1234567890abcdef12345678",
    controllerAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    name: null,
    description: null,
    imageUrl: null,
    metadataUri: null,
    endpoints: null,
    capabilities: null,
    tags: null,
    oasfSkills: null,
    oasfDomains: null,
    supportedTrust: null,
    x402Support: false,
    activeStatus: false,
    claimed: false,
    firstSeenBlock: 1000000,
    lastUpdatedBlock: 1000000,
    createdAt: new Date("2025-06-01T00:00:00Z"),
    slug: null,
    trustScore: null,
    trustScoreBreakdown: null,
    trustScoreUpdatedAt: null,
    qualityTier: null,
    spamFlags: null,
    lifecycleStatus: null,
    metadataFingerprint: null,
    nextEnrichmentAt: null,
    lastQualityEvaluatedAt: null,
    trustSignalHash: null,
    trustMethodologyVersion: null,
    confidenceScore: null,
    confidenceLevel: null,
    sybilSignals: null,
    sybilRiskScore: null,
    ...overrides,
  } as Agent;
}

/** Well-established agent with full metadata — should score high. */
export const TRUSTED_AGENT = baseAgent({
  id: "trusted-agent-1",
  name: "TradingBot Pro",
  description: "A sophisticated autonomous trading agent that executes DeFi strategies across multiple protocols with built-in risk management and transparent operation.",
  imageUrl: "https://example.com/avatar.png",
  metadataUri: "ipfs://QmTestHash123456",
  endpoints: [
    { url: "https://api.tradingbot.pro/v1", name: "Main API" },
    { url: "https://api.tradingbot.pro/health", name: "Health" },
    { url: "https://api.tradingbot.pro/status", name: "Status" },
  ],
  tags: ["defi", "trading", "autonomous"],
  oasfSkills: ["market-data", "portfolio-management"],
  oasfDomains: ["finance"],
  supportedTrust: ["eip712", "erc7710", "x402"],
  x402Support: true,
  activeStatus: true,
  createdAt: new Date("2024-01-01T00:00:00Z"), // Old agent
  trustScore: 72,
  qualityTier: "high",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent with moderate profile — should score medium. */
export const CAUTION_AGENT = baseAgent({
  id: "caution-agent-1",
  name: "SimpleHelper",
  description: "A basic helper agent for simple tasks.",
  imageUrl: null,
  metadataUri: "https://example.com/metadata.json",
  endpoints: [{ url: "https://api.simplehelper.com", name: "API" }],
  tags: ["helper"],
  oasfSkills: null,
  oasfDomains: null,
  supportedTrust: null,
  x402Support: false,
  activeStatus: true,
  createdAt: new Date("2025-11-01T00:00:00Z"),
  trustScore: 35,
  qualityTier: "medium",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Spam agent — should be classified as untrusted. */
export const SPAM_AGENT = baseAgent({
  id: "spam-agent-1",
  name: "test",
  description: null,
  imageUrl: null,
  metadataUri: "https://eips.ethereum.org/EIPS/eip-8004",
  endpoints: null,
  tags: null,
  oasfSkills: null,
  oasfDomains: null,
  supportedTrust: null,
  x402Support: false,
  activeStatus: false,
  createdAt: new Date("2025-12-01T00:00:00Z"),
  trustScore: 5,
  qualityTier: "spam",
  spamFlags: ["test_agent", "spec_uri"],
  lifecycleStatus: "active",
});

/** Agent with no data at all — represents newly discovered, unscored agent. */
export const UNKNOWN_AGENT = baseAgent({
  id: "unknown-agent-1",
  name: null,
  description: null,
  trustScore: null,
  qualityTier: null,
  spamFlags: null,
  lifecycleStatus: null,
});

/** Archived spam agent — old and flagged. */
export const ARCHIVED_AGENT = baseAgent({
  id: "archived-agent-1",
  name: null,
  description: null,
  trustScore: 3,
  qualityTier: "archived",
  spamFlags: ["whitespace_name", "blank_uri"],
  lifecycleStatus: "archived",
  createdAt: new Date("2024-01-01T00:00:00Z"),
});

/** Agent at the TRUSTED/CAUTION boundary (score 60, high tier, no flags). */
export const BOUNDARY_TRUSTED = baseAgent({
  id: "boundary-trusted",
  name: "BoundaryAgent",
  trustScore: 60,
  qualityTier: "high",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent at the CAUTION/UNTRUSTED boundary (score 30). */
export const BOUNDARY_CAUTION = baseAgent({
  id: "boundary-caution",
  name: "CautionBoundary",
  trustScore: 30,
  qualityTier: "low",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent just below UNTRUSTED threshold (score 29). */
export const BOUNDARY_UNTRUSTED = baseAgent({
  id: "boundary-untrusted",
  name: "UntrustedBoundary",
  trustScore: 29,
  qualityTier: "low",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent with high score but has spam flags — flags override score. */
export const HIGH_SCORE_WITH_FLAGS = baseAgent({
  id: "flagged-high",
  name: "FlaggedAgent",
  trustScore: 80,
  qualityTier: "high",
  spamFlags: ["duplicate_template"],
  lifecycleStatus: "active",
});

/** Agent from a large Sybil farm (controller has 500+ agents). */
export const SYBIL_FARM_AGENT = baseAgent({
  id: "sybil-farm-1",
  controllerAddress: "0xsybilcontroller000000000000000000000000001",
  name: "FarmAgent #347",
  description: "Automated agent from a large farm",
  metadataFingerprint: "fp_duplicate_cluster_1",
  trustScore: 45,
  qualityTier: "low",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Agent from a small multi-agent controller (15 agents — borderline). */
export const SMALL_CLUSTER_AGENT = baseAgent({
  id: "small-cluster-1",
  controllerAddress: "0xsmallcluster0000000000000000000000000001",
  name: "ClusterBot",
  description: "Agent from a small but legitimate multi-agent operator with decent metadata quality.",
  metadataFingerprint: "fp_unique_1",
  trustScore: 52,
  qualityTier: "medium",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Legitimate single-agent controller — should not be flagged. */
export const SOLO_CONTROLLER_AGENT = baseAgent({
  id: "solo-controller-1",
  controllerAddress: "0xsolocontroller00000000000000000000000001",
  name: "IndependentBot",
  description: "A well-maintained agent by an independent operator with unique metadata and strong community presence.",
  metadataFingerprint: "fp_unique_solo",
  trustScore: 70,
  qualityTier: "high",
  spamFlags: [],
  lifecycleStatus: "active",
});

/** Rich community feedback for the trusted agent. */
export const TRUSTED_FEEDBACK: CommunityFeedbackSummary = {
  id: 1,
  agentId: "trusted-agent-1",
  totalSources: 3,
  githubHealthScore: 80,
  githubStars: 120,
  githubForks: 34,
  githubOpenIssues: 5,
  githubLastCommitAt: new Date("2026-04-10T08:00:00Z"),
  githubContributors: 8,
  githubLanguage: "TypeScript",
  githubDescription: "A trading bot agent",
  farcasterScore: 0.7,
  farcasterFollowers: 450,
  farcasterFollowing: 100,
  farcasterFid: null,
  farcasterLastCastAt: null,
  farcasterTotalCasts: 50,
  farcasterEngagementAvg: null,
  twitterMentions: null,
  twitterSentimentPct: null,
  redditMentions: null,
  overallScore: 85,
  lastUpdatedAt: new Date("2026-04-12T04:00:00Z"),
} as CommunityFeedbackSummary;

/** No community feedback at all. */
export const NO_FEEDBACK = null;
