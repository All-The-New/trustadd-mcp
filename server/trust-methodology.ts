import { METHODOLOGY_VERSION } from "./trust-provenance.js";

export interface ThresholdCondition {
  condition: string;
  points: number;
}

export interface Signal {
  name: string;
  maxPoints: number;
  description: string;
  thresholds: ThresholdCondition[];
}

export interface Dimension {
  name: string;
  maxPoints: number;
  signals: Signal[];
}

export interface VerdictThresholds {
  trusted: string;
  caution: string;
  untrusted: string;
  unknown: string;
}

export interface ChangelogEntry {
  version: number;
  date: string;
  summary: string;
}

export interface Methodology {
  version: number;
  lastUpdated: string;
  maxScore: number;
  verdictThresholds: VerdictThresholds;
  dimensions: Dimension[];
  changelog: ChangelogEntry[];
  disclaimer: string;
}

export function getMethodology(): Methodology {
  return {
    version: METHODOLOGY_VERSION,
    lastUpdated: "2026-04-13",
    maxScore: 100,
    verdictThresholds: {
      trusted: "score >= 60 AND tier in (high, medium) AND no spam flags",
      caution: "All agents not meeting trusted or untrusted criteria",
      untrusted: "score < 30 OR tier in (spam, archived) OR status = archived",
      unknown: "Score has not yet been calculated",
    },
    dimensions: [
      {
        name: "Identity",
        maxPoints: 25,
        signals: [
          {
            name: "agent_name",
            maxPoints: 5,
            description: "Agent has a descriptive name",
            thresholds: [
              { condition: "name present and non-empty", points: 5 },
              { condition: "no name", points: 0 },
            ],
          },
          {
            name: "description_quality",
            maxPoints: 5,
            description: "Quality and length of agent description",
            thresholds: [
              { condition: "description >= 100 characters", points: 5 },
              { condition: "description >= 30 characters", points: 3 },
              { condition: "description > 0 characters", points: 1 },
              { condition: "no description", points: 0 },
            ],
          },
          {
            name: "image_url",
            maxPoints: 5,
            description: "Agent has a valid image URL",
            thresholds: [
              { condition: "valid image URL (PNG, SVG, IPFS, etc.)", points: 5 },
              { condition: "no image", points: 0 },
            ],
          },
          {
            name: "endpoints_declared",
            maxPoints: 5,
            description: "Agent declares at least one API endpoint",
            thresholds: [
              { condition: "1 or more endpoints declared", points: 5 },
              { condition: "no endpoints", points: 0 },
            ],
          },
          {
            name: "tags_or_skills",
            maxPoints: 5,
            description: "Agent has tags or OASF skills for discoverability",
            thresholds: [
              { condition: "tags or OASF skills present", points: 5 },
              { condition: "no tags or skills", points: 0 },
            ],
          },
        ],
      },
      {
        name: "History",
        maxPoints: 20,
        signals: [
          {
            name: "agent_age",
            maxPoints: 10,
            description: "Time elapsed since agent registration",
            thresholds: [
              { condition: "agent age >= 30 days", points: 10 },
              { condition: "agent age >= 7 days", points: 5 },
              { condition: "agent age >= 1 day", points: 2 },
              { condition: "agent age < 1 day", points: 0 },
            ],
          },
          {
            name: "metadata_updates",
            maxPoints: 5,
            description: "Number of metadata update events (MetadataUpdated, AgentURISet)",
            thresholds: [
              { condition: "2 or more update events", points: 5 },
              { condition: "1 update event", points: 2 },
              { condition: "no updates", points: 0 },
            ],
          },
          {
            name: "cross_chain_presence",
            maxPoints: 5,
            description: "Number of distinct chains where controller is registered",
            thresholds: [
              { condition: "3 or more chains", points: 5 },
              { condition: "2 chains", points: 3 },
              { condition: "1 chain", points: 0 },
            ],
          },
        ],
      },
      {
        name: "Capability",
        maxPoints: 15,
        signals: [
          {
            name: "x402_payment",
            maxPoints: 5,
            description: "Agent supports x402 payment headers",
            thresholds: [
              { condition: "x402 support confirmed", points: 5 },
              { condition: "no x402 support", points: 0 },
            ],
          },
          {
            name: "oasf_skills",
            maxPoints: 5,
            description: "Number of registered OASF skills and domains",
            thresholds: [
              { condition: "3 or more skills/domains", points: 5 },
              { condition: "1-2 skills/domains", points: 3 },
              { condition: "no skills/domains", points: 0 },
            ],
          },
          {
            name: "endpoint_count",
            maxPoints: 5,
            description: "Number of declared API endpoints",
            thresholds: [
              { condition: "3 or more endpoints", points: 5 },
              { condition: "1-2 endpoints", points: 3 },
              { condition: "no endpoints", points: 0 },
            ],
          },
        ],
      },
      {
        name: "Community",
        maxPoints: 20,
        signals: [
          {
            name: "github_health",
            maxPoints: 10,
            description: "Community feedback score from GitHub activity",
            thresholds: [
              { condition: "GitHub health score >= 70", points: 10 },
              { condition: "GitHub health score >= 40", points: 6 },
              { condition: "GitHub health score > 0", points: 3 },
              { condition: "no GitHub data", points: 0 },
            ],
          },
          {
            name: "farcaster_presence",
            maxPoints: 5,
            description: "Community signal strength from Farcaster",
            thresholds: [
              { condition: "Farcaster score >= 0.7", points: 5 },
              { condition: "Farcaster score >= 0.4", points: 3 },
              { condition: "Farcaster score > 0", points: 1 },
              { condition: "no Farcaster data", points: 0 },
            ],
          },
          {
            name: "community_sources",
            maxPoints: 5,
            description: "Presence in community data sources",
            thresholds: [
              { condition: "listed in 1 or more sources", points: 5 },
              { condition: "not listed in any sources", points: 0 },
            ],
          },
        ],
      },
      {
        name: "Transparency",
        maxPoints: 20,
        signals: [
          {
            name: "metadata_storage",
            maxPoints: 8,
            description: "Where agent metadata is stored",
            thresholds: [
              { condition: "IPFS or Arweave (immutable)", points: 8 },
              { condition: "HTTPS (secure)", points: 5 },
              { condition: "HTTP (insecure)", points: 3 },
              { condition: "data URI (embedded)", points: 2 },
              { condition: "no metadata", points: 0 },
            ],
          },
          {
            name: "trust_protocols",
            maxPoints: 7,
            description: "Number of supported trust protocols (eip712, erc7710, etc.)",
            thresholds: [
              { condition: "3 or more trust protocols", points: 7 },
              { condition: "2 trust protocols", points: 5 },
              { condition: "1 trust protocol", points: 3 },
              { condition: "no trust protocols", points: 0 },
            ],
          },
          {
            name: "active_status",
            maxPoints: 5,
            description: "Agent explicitly marked as active",
            thresholds: [
              { condition: "activeStatus = true", points: 5 },
              { condition: "activeStatus not set or false", points: 0 },
            ],
          },
        ],
      },
    ],
    changelog: [
      {
        version: 1,
        date: "2026-04-13",
        summary:
          "Initial methodology. Five dimensions (Identity, History, Capability, Community, Transparency) with 18 signals covering agent metadata, on-chain history, capabilities, community reputation, and metadata transparency. Maximum score 100, with verdict thresholds for trusted, caution, untrusted, and unknown states.",
      },
    ],
    disclaimer:
      "TrustAdd scores reflect available evidence as of the assessment timestamp. They are not guarantees of safety. Verify independently for high-value decisions.",
  };
}
