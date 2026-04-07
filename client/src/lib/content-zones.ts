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
    tag: "AI Agent Trust Ratings",
    title: "Trust Ratings for",
    titleAccent: "AI Agents",
    subtitle:
      "Indexing identity, reputation, and on-chain signals across protocols and chains into transparent, verifiable trust scores.",
    ctaPrimary: "Explore Agents",
    ctaSecondary: "View API",
  },
  features: [
    {
      icon: "Layers" as const,
      title: "Multi-Protocol Discovery",
      desc: "Indexes agents from ERC-8004, x402, OASF, and emerging standards. No sign-ups — if it's on-chain, TrustAdd finds it.",
    },
    {
      icon: "Shield" as const,
      title: "Transparent Trust Scores",
      desc: "Every agent receives a 0–100 TrustAdd Score computed from five signal categories: identity, history, capability, community, and transparency.",
    },
    {
      icon: "Bot" as const,
      title: "Human & Machine Readable",
      desc: "Clear profiles anyone can understand, plus a free public REST API so other agents and apps can query trust programmatically.",
    },
  ],
  pillars: {
    heading: "The Three Pillars of Agent Trust",
    subtitle:
      "Indexing signals from multiple protocols and chains into three core trust dimensions.",
    items: [
      {
        icon: "Shield" as const,
        title: "Identity & Capability Signals",
        desc: "Completeness of metadata, declared skills, endpoints, and x402 payment support. Agents with rich identity data and clear capabilities score higher.",
        badge: "Identity + Capability",
        badgeVariant: "live" as const,
      },
      {
        icon: "Star" as const,
        title: "Community & Reputation",
        desc: "GitHub health scores, Farcaster engagement, on-chain feedback, and community endorsements. Real-world signals from the people and systems that interact with agents.",
        badge: "Community",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Eye" as const,
        title: "On-Chain Transparency",
        desc: "Decentralized storage, multi-chain presence, registration longevity, and trust mechanism declarations. Transparency signals accountability and staying power.",
        badge: "History + Transparency",
        badgeVariant: "live" as const,
      },
    ],
  },
  api: {
    title: "Public API",
    desc: "Everything in TrustAdd is available via a simple REST API. Query agents, read trust scores, and integrate multi-protocol agent data into your own systems.",
    cta: "View Documentation",
  },
  topTrusted: {
    heading: "Top Trusted Agents",
    viewAll: "View leaderboard",
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
    "The indexer is scanning supported blockchains for AI agent identities. Agents will appear here automatically as they are discovered.",
};

export const STATS = {
  agentsLabel: "Agents Indexed",
  metadataLabel: "TrustAdd Verified",
  x402Label: "x402 Enabled",
  blockLabel: "Last Block",
};

export const ABOUT = {
  header: {
    title: "About TrustAdd",
    subtitle:
      "Trust ratings for AI agents across protocols and chains. We believe trust should be measurable, transparent, and open to everyone.",
  },
  mission: {
    title: "Our Mission",
    paragraphs: [
      "As AI agents become more autonomous, knowing which ones to trust matters more than ever. TrustAdd indexes identity, reputation, and on-chain signals from multiple protocols — including ERC-8004, x402, and emerging standards — across 9 EVM chains including Ethereum, Base, Polygon, Arbitrum, BNB Chain, Celo, Gnosis, Optimism, and Avalanche.",
      "We're building a universal trust layer for AI agents. By combining on-chain identity, community signals, and capability data into a single, transparent score, TrustAdd gives both humans and machines a reliable way to evaluate agent trustworthiness.",
    ],
  },
  score: {
    title: "How the TrustAdd Score Works",
    intro:
      "Every indexed agent receives a TrustAdd Score from 0 to 100. The score is computed from five categories of on-chain and off-chain signals, weighted to reflect what matters most for trust.",
  },
  principles: {
    title: "Principles",
    items: [
      {
        title: "Neutral & Factual",
        desc: "We present data as-is. No endorsements, no rankings manipulation. The score is a formula applied equally to every agent.",
      },
      {
        title: "Open & Free",
        desc: "All data is accessible via our public REST API at no cost. No authentication required. Build on top of TrustAdd freely.",
      },
      {
        title: "Discovery-First",
        desc: "We find agents automatically by scanning blockchains and indexing protocol events. No manual submissions, no gatekeeping.",
      },
    ],
  },
  protocols: {
    title: "Supported Protocols",
    intro:
      "TrustAdd indexes agent data from multiple protocols. Each feeds different trust signals into the TrustAdd Score.",
  },
};

export const PROTOCOLS = {
  pageTitle: "Protocols Supported",
  pageSubtitle:
    "TrustAdd indexes agent identity, reputation, and capability data from multiple protocols across EVM chains.",
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
      "Free public REST API for querying AI agent trust scores, identities, and on-chain events across protocols and EVM chains. No authentication required.",
  },
  intro:
    "Access everything in TrustAdd programmatically. Query agents, read trust scores and on-chain history, and integrate multi-protocol agent data into your own applications. No authentication required.",
  usageNotes: {
    dataSource:
      "Agent data is sourced from 9 active EVM chains (Ethereum, Base, Polygon, Arbitrum, BNB Chain, Celo, Gnosis, Optimism, Avalanche) via multiple protocols including ERC-8004 and x402. Data freshness depends on indexer status. Use the chainId parameter to filter by chain.",
  },
};

export const ANALYTICS = {
  seo: {
    title: "Network Analytics",
    description:
      "Live analytics and insights across all indexed AI agent identities, including TrustAdd Score distribution, chain metrics, and protocol adoption trends.",
  },
  subtitle: "Live insights across all indexed AI agent identities",
};

export const ECONOMY = {
  seo: {
    title: "Agent Economy — x402 Payment Ecosystem | TrustAdd",
    description:
      "Explore the x402 agent payment ecosystem. See which AI agents support payments, endpoint types, and adoption across EVM chains.",
  },
};

export const SKILLS = {
  seo: {
    title: "Skills & Capabilities — AI Agent Ecosystem | TrustAdd",
    description:
      "Explore what AI agents can do. Browse capabilities, skill categories, trust correlations, and the most capable agents across EVM chains.",
  },
  subtitle: "What AI agents can do across protocols and chains",
};

export const STATUS = {
  seo: {
    title: "Indexer Status",
    description:
      "Live monitoring of TrustAdd's multi-chain, multi-protocol indexer. View health status, alerts, and per-chain indexing progress.",
  },
};

export const DIRECTORY = {
  seo: {
    title: "Agents",
    description:
      "Browse and search all AI agent identities discovered across 9 EVM chains. Filter by trust score, chain, protocol support, and more.",
  },
  emptyState:
    "The indexer is scanning for AI agent identities across supported chains. Check back soon.",
  subtitle: (total: number, chainCount: number) =>
    total > 0
      ? `${total.toLocaleString()} agents indexed across ${chainCount} chains`
      : "Discovering AI agent identities across supported chains",
};

export const PROFILE = {
  defaultDescription: (chainName: string) =>
    `This agent was automatically discovered on the ${chainName} blockchain. No additional description has been provided.`,
  defaultSeoDescription: (erc8004Id: number, chainName: string) =>
    `AI agent #${erc8004Id} on ${chainName}. View trust score, metadata, and on-chain history.`,
  reputationEmpty:
    "This agent hasn't received any on-chain reputation feedback yet. As the protocol ecosystem matures, endorsements and reputation signals from other agents and users will appear here.",
  statusDiscovery: "Discovered automatically via on-chain indexing",
};

export const NAV = {
  footer: {
    tagline:
      "Neutral public infrastructure for AI agent trust ratings.",
  },
};

export const SEO = {
  landing: {
    title: "AI Agent Trust Ratings",
    description:
      "TrustAdd is a public, neutral trust rating platform for AI agents across protocols and EVM chains. Discover, verify, and compare agents with the TrustAdd Score.",
  },
  about: {
    title: "About",
    description:
      "Learn about TrustAdd's mission, the TrustAdd Score methodology, and our vision for a universal AI agent trust layer.",
  },
  protocols: {
    title: "Protocols",
    description:
      "Explore the protocols TrustAdd indexes — ERC-8004, x402, OASF, MCP, A2A, and more. See how each feeds into the TrustAdd Score.",
  },
};
