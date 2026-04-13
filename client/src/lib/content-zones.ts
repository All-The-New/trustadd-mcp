import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Layers,
  Eye,
  Star,
  Globe,
  Bot,
  Zap,
  Network,
  FileCode,
  Wrench,
  MessageSquare,
} from "lucide-react";

export const HOME = {
  hero: {
    tag: "The Trust Oracle for the Agent Economy",
    title: "The Trust Oracle for the",
    titleAccent: "Agent Economy",
    subtitle:
      "Before your agent transacts, it checks TrustAdd. We index identity, payments, and reputation across 9 chains into a single trust verdict — queryable by any agent via x402 micropayment.",
    ctaPrimary: "Explore Agents",
    ctaSecondary: "Trust API",
  },
  features: [
    {
      icon: "Shield" as const,
      title: "Trust Intelligence On Demand",
      desc: "Agents query TrustAdd before transacting — like a credit check for the agent economy. Quick verdicts from $0.01 USDC, full evidence reports from $0.05.",
    },
    {
      icon: "Layers" as const,
      title: "Cross-Layer Intelligence",
      desc: "The only oracle combining ERC-8004 identity, x402 payment data, marketplace analytics, and community signals into one composite trust score.",
    },
    {
      icon: "Bot" as const,
      title: "Built for Agents, Readable by Humans",
      desc: "Machine-queryable Trust API via x402 and MCP. Free ecosystem analytics for developers and researchers exploring the agent economy.",
    },
  ],
  pillars: {
    heading: "Five Dimensions of Agent Trust",
    subtitle:
      "Every trust verdict is computed from five signal categories, weighted to reflect what matters most for autonomous decision-making.",
    items: [
      {
        icon: "Shield" as const,
        title: "Identity & Capability",
        desc: "On-chain identity completeness, declared skills, endpoints, x402 payment support. Agents with verifiable identity and clear capabilities score higher.",
        badge: "Identity + Capability",
        badgeVariant: "live" as const,
      },
      {
        icon: "Star" as const,
        title: "Community & Reputation",
        desc: "GitHub health, Farcaster engagement, on-chain feedback. Real-world signals from people and systems that interact with agents.",
        badge: "Community",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Eye" as const,
        title: "History & Transparency",
        desc: "Registration longevity, multi-chain presence, decentralized storage, trust mechanism declarations. Transparency signals accountability.",
        badge: "History + Transparency",
        badgeVariant: "live" as const,
      },
    ],
  },
  api: {
    title: "Trust Oracle API",
    desc: "Agents query TrustAdd before transacting. Ecosystem analytics are free and open. Trust intelligence starts at $0.01 per query via x402 micropayment on Base.",
    cta: "View Trust API",
  },
  topTrusted: {
    heading: "Top Trusted Agents",
    viewAll: "View all agents",
    emptyState: "Trust scores are being calculated. Check back soon.",
  },
  recentlyDiscovered: {
    heading: "Recently Discovered",
    viewAll: "View all agents",
  },
  liveIndexing: {
    heading: "Live Indexing",
  },
  emptyState:
    "The oracle is scanning blockchains for AI agent identities. Agents will appear here automatically as they are discovered.",
};

export const STATS = {
  agentsLabel: "Agents Indexed",
  metadataLabel: "Oracle Verified",
  x402Label: "x402 Active",
  blockLabel: "Last Block",
};

export const ABOUT = {
  header: {
    title: "About TrustAdd",
    subtitle:
      "The trust oracle for the agent economy. We believe trust should be measurable, transparent, and queryable by any agent.",
  },
  mission: {
    title: "Our Mission",
    paragraphs: [
      "As AI agents transact autonomously, knowing which ones to trust is critical infrastructure. TrustAdd is the trust oracle — agents query us before transacting, the way financial systems query credit bureaus before lending.",
      "We index identity, payments, and reputation signals from ERC-8004, x402, and emerging standards across 9 EVM chains. We combine them into a single, transparent trust verdict — available to any agent via x402 micropayment, and to any human through our free analytics dashboard.",
    ],
  },
  score: {
    title: "How the TrustAdd Score Works",
    intro:
      "Every indexed agent receives a TrustAdd Score from 0 to 100, computed from five categories of on-chain and off-chain signals. The score powers trust verdicts: TRUSTED, CAUTION, UNTRUSTED, or UNKNOWN.",
  },
  principles: {
    title: "Principles",
    items: [
      {
        title: "Neutral & Verifiable",
        desc: "We present data as-is. No endorsements, no manipulation. The scoring formula is applied equally to every agent, and the methodology is published openly.",
      },
      {
        title: "Open Ecosystem, Paid Intelligence",
        desc: "Ecosystem analytics are free — no auth required. Per-agent trust intelligence is available via x402 micropayment, from $0.01 per query. We charge for intelligence, not access.",
      },
      {
        title: "Discovery-First",
        desc: "We find agents automatically by scanning blockchains and indexing protocol events. No manual submissions, no gatekeeping. If it's on-chain, TrustAdd finds it.",
      },
    ],
  },
  protocols: {
    title: "Supported Protocols",
    intro:
      "TrustAdd indexes agent data from multiple protocols. Each feeds different trust signals into the oracle.",
  },
};

export const PROTOCOLS = {
  pageTitle: "Protocols",
  pageSubtitle:
    "TrustAdd indexes agent identity, payments, and capability data from multiple protocols — feeding trust signals into the oracle.",
  items: [
    {
      id: "erc-8004",
      name: "ERC-8004",
      tagline: "On-Chain Identity Registry",
      icon: "Shield" as const,
      description:
        "An Ethereum standard that gives every AI agent a unique, verifiable on-chain identity. Each identity is an NFT owned by the agent's controller, pointing to a metadata file with the agent's name, description, capabilities, and endpoints.",
      howItWorks:
        "Agents are registered through an Identity Registry smart contract deployed on each chain. The registry emits events when agents register, update metadata, or receive reputation feedback. TrustAdd monitors these events in real-time.",
      whatWeTrack: [
        "Agent registration and identity metadata",
        "Metadata updates and versioning",
        "Reputation feedback from other agents",
        "Controller ownership changes",
      ],
      chains: ["Ethereum", "Base", "Polygon", "Arbitrum", "BNB Chain", "Celo", "Gnosis", "Optimism", "Avalanche"],
      status: "live" as const,
      scoreCategories: ["Identity", "History", "Transparency"],
    },
    {
      id: "x402",
      name: "x402 / HTTP 402",
      tagline: "Agent Payment Protocol",
      icon: "Zap" as const,
      description:
        "A payment protocol that lets AI agents charge for their services using the HTTP 402 status code. When an agent's endpoint returns a 402 response, it signals that payment is required and includes pricing information.",
      howItWorks:
        "TrustAdd probes agent HTTP endpoints looking for 402 responses with payment headers. When found, it records the payment address, accepted tokens, and pricing. It then tracks on-chain transactions to those payment addresses.",
      whatWeTrack: [
        "x402-enabled endpoint discovery",
        "Payment address and accepted tokens",
        "On-chain transaction volume (USDC, USDT, DAI, WETH, ETH)",
        "Endpoint availability and response patterns",
      ],
      chains: ["Ethereum", "Base", "Polygon", "Arbitrum", "BNB Chain", "Celo", "Gnosis", "Optimism", "Avalanche"],
      status: "live" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "oasf",
      name: "OASF",
      tagline: "Open Agent Skills Framework",
      icon: "FileCode" as const,
      description:
        "A standard for agents to declare their capabilities and skills in a machine-readable format. OASF lets agents publish what they can do so other agents and platforms can discover and utilize their services.",
      howItWorks:
        "Agents include OASF skill declarations in their metadata. TrustAdd parses these declarations to understand what each agent is capable of, feeding capability signals into the trust score.",
      whatWeTrack: [
        "Declared skills and capabilities",
        "Skill categories and descriptions",
        "Endpoint associations per skill",
      ],
      chains: ["Protocol-agnostic"],
      status: "live" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "mcp",
      name: "MCP",
      tagline: "Model Context Protocol",
      icon: "Wrench" as const,
      description:
        "A protocol for exposing tools and data sources to language models. MCP-compatible agents can serve as tool providers, giving other AI systems structured access to their capabilities.",
      howItWorks:
        "Agents that support MCP declare tool endpoints in their metadata. TrustAdd detects MCP declarations and considers them a capability signal in the trust score.",
      whatWeTrack: [
        "MCP tool declarations",
        "Endpoint availability",
      ],
      chains: ["Protocol-agnostic"],
      status: "tracking" as const,
      scoreCategories: ["Capability"],
    },
    {
      id: "a2a",
      name: "A2A",
      tagline: "Agent-to-Agent Communication",
      icon: "Network" as const,
      description:
        "A communication protocol enabling direct, structured interactions between AI agents. A2A provides standardized message formats and discovery mechanisms for multi-agent workflows.",
      howItWorks:
        "Agents that support A2A publish agent cards describing their capabilities and communication endpoints. TrustAdd indexes these declarations as part of its capability assessment.",
      whatWeTrack: [
        "A2A agent card declarations",
        "Communication endpoint availability",
      ],
      chains: ["Protocol-agnostic"],
      status: "tracking" as const,
      scoreCategories: ["Capability"],
    },
  ],
  emerging: {
    title: "Emerging Standards",
    description:
      "We're actively monitoring new agent protocols and standards as they develop. As these mature and gain adoption, TrustAdd will integrate their signals into the trust score.",
    items: [
      "Olas — Autonomous agent framework with on-chain service registries",
      "Virtuals Protocol — Agent tokenization and trading platform",
      "Twitter/X Sentiment — Social reputation signals from agent-related discussions",
      "Agent Claiming — Verified operator identity and context",
    ],
  },
};

export const API_DOCS = {
  seo: {
    title: "API Documentation",
    description:
      "REST API for the agent economy. Free ecosystem analytics, plus x402-gated trust intelligence from $0.01 per query.",
  },
  intro:
    "TrustAdd provides two API tiers. Ecosystem analytics are free and open — no authentication required. Per-agent trust intelligence (scores, verdicts, breakdowns, evidence) is available via x402 micropayment.",
  usageNotes: {
    dataSource:
      "Data is sourced from 9 EVM chains via ERC-8004, x402, OASF, and community signals. Data freshness depends on indexer status. Use the chainId parameter to filter by chain.",
  },
};

export const ANALYTICS = {
  seo: {
    title: "Ecosystem Analytics",
    description:
      "Free, live analytics across the AI agent economy — trust score distributions, chain metrics, protocol adoption, and ecosystem growth trends.",
  },
  subtitle: "Free, live insights across the AI agent economy",
};

export const ECONOMY = {
  seo: {
    title: "Agent Economy",
    description:
      "Explore the x402 agent payment ecosystem. Transaction volumes, payment adoption, top-earning agents, and economic trends across 9 EVM chains.",
  },
};

export const SKILLS = {
  seo: {
    title: "Agent Skills & Capabilities",
    description:
      "What AI agents can do. Browse capabilities, skill categories, trust correlations, and the most capable agents in the ecosystem.",
  },
  subtitle: "What agents can do across protocols and chains",
};

export const STATUS = {
  seo: {
    title: "Oracle Status",
    description:
      "Live monitoring of TrustAdd's multi-chain oracle. Indexer health, per-chain progress, and system alerts.",
  },
};

export const DIRECTORY = {
  seo: {
    title: "Agent Directory",
    description:
      "Browse all AI agent identities discovered by the TrustAdd oracle across 9 EVM chains. Filter by chain, protocol support, and trust verdict.",
  },
  emptyState:
    "The oracle is scanning for AI agent identities. Agents will appear here as they are discovered.",
  subtitle: (total: number, chainCount: number) =>
    total > 0
      ? `${total.toLocaleString()} agents indexed across ${chainCount} chains`
      : "Discovering AI agent identities across supported chains",
};

export const PROFILE = {
  defaultDescription: (chainName: string) =>
    `This agent was discovered by the TrustAdd oracle on ${chainName}. No additional description has been provided.`,
  defaultSeoDescription: (erc8004Id: string | number, chainName: string) =>
    `AI agent #${erc8004Id} on ${chainName}. Trust verdict, score breakdown, and on-chain history from TrustAdd.`,
  reputationEmpty:
    "This agent hasn't received on-chain reputation feedback yet. As the protocol ecosystem matures, endorsements from other agents and users will appear here.",
  statusDiscovery: "Discovered automatically via on-chain indexing",
};

export const METHODOLOGY = {
  header: {
    title: "Scoring Methodology",
    subtitle:
      "How TrustAdd computes trust scores and verdicts. Every signal, weight, and threshold is documented here — the same formula applied equally to every agent.",
  },
  overview: {
    title: "How the TrustAdd Score Works",
    paragraphs: [
      "Every agent indexed by TrustAdd receives a composite trust score from 0 to 100. The score is computed from five categories of on-chain and off-chain signals, each weighted to reflect its importance for autonomous decision-making.",
      "Scores are recalculated daily and on-demand when new data arrives. The same formula is applied to every agent — no manual overrides, no special treatment. The score powers trust verdicts (TRUSTED, CAUTION, UNTRUSTED) that agents can query programmatically via the Trust API.",
    ],
  },
  categories: [
    {
      name: "Identity",
      icon: "Shield" as const,
      maxPoints: 25,
      color: "bg-blue-500",
      description:
        "Does the agent have a complete, well-maintained on-chain identity? Name, description, image, endpoints, and declared skills all contribute. Completeness signals intentional registration rather than placeholder entries.",
      signals: [
        { name: "Name", condition: "Non-empty name field", points: "+5" },
        { name: "Description", condition: "Any / 30+ chars / 100+ chars", points: "+1 / +3 / +5" },
        { name: "Image", condition: "Valid image URL (PNG, SVG, IPFS, etc.)", points: "+5" },
        { name: "Endpoints", condition: "At least one endpoint declared", points: "+5" },
        { name: "Skills / Tags", condition: "OASF skills or tags present", points: "+5" },
      ],
    },
    {
      name: "History",
      icon: "Clock" as const,
      maxPoints: 20,
      color: "bg-purple-500",
      description:
        "How long has the agent existed on-chain? Has it been actively maintained? Agents with longer history, metadata updates, and cross-chain presence demonstrate sustained commitment.",
      signals: [
        { name: "Registration age", condition: "1+ day / 7+ days / 30+ days", points: "+2 / +5 / +10" },
        { name: "Metadata updates", condition: "1+ update events / 2+ update events", points: "+2 / +5" },
        { name: "Cross-chain presence", condition: "2+ chains / 3+ chains (same controller)", points: "+3 / +5" },
      ],
    },
    {
      name: "Capability",
      icon: "Zap" as const,
      maxPoints: 15,
      color: "bg-green-500",
      description:
        "What can the agent actually do? x402 payment support, declared OASF skills, and exposed endpoints demonstrate functional capability beyond a static identity.",
      signals: [
        { name: "x402 support", condition: "Active x402 payment endpoint detected", points: "+5" },
        { name: "OASF skills", condition: "1+ skill / 3+ skills declared", points: "+3 / +5" },
        { name: "Endpoints", condition: "1+ endpoint / 3+ endpoints", points: "+3 / +5" },
      ],
    },
    {
      name: "Community",
      icon: "Users" as const,
      maxPoints: 20,
      color: "bg-amber-500",
      description:
        "What do humans and systems say about this agent? GitHub project health, Farcaster social engagement, and on-chain reputation feedback from other agents provide external validation.",
      signals: [
        { name: "GitHub health", condition: "Score > 0 / 40+ / 70+", points: "+3 / +6 / +10" },
        { name: "Farcaster engagement", condition: "Score > 0 / 0.4+ / 0.7+", points: "+1 / +3 / +5" },
        { name: "Community sources", condition: "Any verified community data source", points: "+5" },
      ],
    },
    {
      name: "Transparency",
      icon: "Eye" as const,
      maxPoints: 20,
      color: "bg-teal-500",
      description:
        "Is the agent's metadata verifiable and immutable? Decentralized storage (IPFS, Arweave) scores highest. Declared trust mechanisms and active status signals further indicate accountability.",
      signals: [
        { name: "Metadata storage", condition: "data: / http / https / IPFS or Arweave", points: "+2 / +3 / +5 / +8" },
        { name: "Trust mechanisms", condition: "1 declared / 2+ / 3+", points: "+3 / +5 / +7" },
        { name: "Active status", condition: "Agent marked as active on-chain", points: "+5" },
      ],
    },
  ],
  principles: [
    {
      title: "Equal Application",
      desc: "The same formula is applied to every agent. No manual score overrides, no premium tiers, no special treatment. The methodology is the product.",
    },
    {
      title: "Observable Inputs Only",
      desc: "Scores are computed from data anyone can verify — on-chain events, public metadata, open-source repos, and protocol-level signals. No private data, no secret sauce.",
    },
    {
      title: "Continuous Recalculation",
      desc: "Scores update automatically as new data arrives. Indexers, probers, and scrapers run on known schedules. Stale reports are recompiled daily and on-demand.",
    },
    {
      title: "Additive Scoring",
      desc: "The score is purely additive — agents start at zero and earn points for each positive signal. There are no penalties or negative adjustments. More evidence means a higher score.",
    },
  ],
};

export const NAV = {
  footer: {
    tagline:
      "The trust oracle for the agent economy.",
  },
};

export const SEO = {
  landing: {
    title: "The Trust Oracle for the Agent Economy",
    description:
      "TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402.",
  },
  about: {
    title: "About",
    description:
      "Learn about TrustAdd's mission as the trust oracle for the agent economy, the TrustAdd Score methodology, and our open, verifiable approach to agent trust.",
  },
  protocols: {
    title: "Protocols",
    description:
      "Protocols powering the TrustAdd oracle — ERC-8004 identity, x402 payments, OASF skills, MCP tools, A2A communication.",
  },
  trustApi: {
    title: "Trust API",
    description:
      "Query the TrustAdd oracle. Quick trust checks from $0.01 USDC, full evidence reports from $0.05. Paid via x402 micropayment on Base. Free ecosystem analytics included.",
  },
  methodology: {
    title: "Scoring Methodology",
    description:
      "How TrustAdd computes agent trust scores. Five scoring categories, signal weights, verdict thresholds, and data sources — fully transparent and equally applied.",
  },
};
