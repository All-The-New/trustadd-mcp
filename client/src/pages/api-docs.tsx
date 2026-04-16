import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { API_DOCS } from "@/lib/content-zones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Globe,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Zap,
  Lock,
} from "lucide-react";
import { SEO } from "@/components/seo";
import { useToast } from "@/hooks/use-toast";

function useClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  return { copiedKey, copy };
}

function CopyButton({ text, id }: { text: string; id: string }) {
  const { copiedKey, copy } = useClipboard();
  const isCopied = copiedKey === id;

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        copy(text, id);
      }}
      data-testid={`button-copy-${id}`}
    >
      {isCopied ? (
        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  gated?: boolean;
  params?: Param[];
  exampleCurl: string;
  exampleResponse: string;
  responseFields: { field: string; description: string }[];
}

const BASE_URL = "https://trustadd.com";

const freeEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/agents",
    description:
      "Get a list of all discovered agents, with search and filtering. Rate limited to 10 requests per minute, max 20 results per page.",
    params: [
      {
        name: "limit",
        type: "number",
        required: false,
        description:
          "Maximum number of agents to return. Defaults to 20, max 20.",
      },
      {
        name: "offset",
        type: "number",
        required: false,
        description:
          "Number of agents to skip for pagination. Defaults to 0.",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description:
          "Search by agent name, description, or contract address.",
      },
      {
        name: "filter",
        type: "string",
        required: false,
        description:
          'Filter agents by status. One of: "all", "has-metadata", "x402-enabled", "has-reputation", "has-feedback".',
      },
      {
        name: "sort",
        type: "string",
        required: false,
        description:
          'Sort order. One of: "newest" (default), "oldest", "trust-score", "name".',
      },
      {
        name: "chainId",
        type: "number",
        required: false,
        description:
          "Filter agents by chain: 1 (Ethereum), 8453 (Base), 56 (BNB Chain), 137 (Polygon), 42161 (Arbitrum), 42220 (Celo), 100 (Gnosis), 10 (Optimism), 43114 (Avalanche). Omit for all chains.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/agents?limit=2&filter=has-metadata"`,
    exampleResponse: JSON.stringify(
      {
        agents: [
          {
            id: "abc-123",
            erc8004Id: "42",
            primaryContractAddress: "0x1234...abcd",
            name: "WeatherBot",
            description: "Provides real-time weather data",
            chainId: 1,
            firstSeenBlock: 19500000,
            tags: ["weather", "api"],
            x402Support: true,
            verdict: "TRUSTED",
            reportAvailable: true,
          },
        ],
        total: 13202,
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "agents",
        description: "Array of agent objects matching your query.",
      },
      {
        field: "total",
        description:
          "Total number of agents matching the filter (for pagination).",
      },
      {
        field: "agents[].erc8004Id",
        description: "The agent's unique on-chain ERC-8004 token ID.",
      },
      {
        field: "agents[].chainId",
        description: "The chain ID where this agent was discovered (1 = Ethereum, 8453 = Base, 56 = BNB Chain, 137 = Polygon, 42161 = Arbitrum, 42220 = Celo, 100 = Gnosis, 10 = Optimism, 43114 = Avalanche).",
      },
      {
        field: "agents[].primaryContractAddress",
        description: "The contract address of the agent on its respective chain.",
      },
      {
        field: "agents[].verdict",
        description: 'High-level trust signal derived from ecosystem data: "VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN". Not a substitute for a full Trust Report.',
      },
      {
        field: "agents[].reportAvailable",
        description: "Whether a full Agent Trust Report is available for this agent via the x402-gated Trust Report API.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/agents/:id",
    description: "Get the identity profile for a single agent by its internal ID. Returns identity, capability, and ecosystem metadata. Trust scores, score breakdowns, community signals, and transaction history are available via the Trust Report API.",
    params: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "The internal UUID of the agent (from the agents list).",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/agents/abc-123"`,
    exampleResponse: JSON.stringify(
      {
        id: "abc-123",
        erc8004Id: "42",
        primaryContractAddress: "0x1234...abcd",
        controllerAddress: "0xabcd...1234",
        chainId: 1,
        name: "WeatherBot",
        description: "Provides real-time weather data",
        firstSeenBlock: 19500000,
        lastUpdatedBlock: 19600000,
        capabilities: ["weather-lookup", "forecast"],
        metadataUri: "ipfs://Qm...",
        tags: ["weather", "api"],
        x402Support: true,
        imageUrl: "https://example.com/avatar.png",
        verdict: "TRUSTED",
        reportAvailable: true,
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "controllerAddress",
        description:
          "The Ethereum address that controls this agent's identity.",
      },
      {
        field: "capabilities",
        description: "List of capabilities the agent has declared.",
      },
      {
        field: "metadataUri",
        description:
          "URI pointing to the agent's full metadata (often IPFS).",
      },
      {
        field: "imageUrl",
        description: "URL of the agent's avatar image, if available.",
      },
      {
        field: "x402Support",
        description:
          "Whether the agent supports the x402 payment protocol.",
      },
      {
        field: "verdict",
        description: 'High-level trust signal: "VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN".',
      },
      {
        field: "reportAvailable",
        description: "Whether a full Agent Trust Report is available via the x402-gated Trust Report API.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/events/recent",
    description:
      "Get the most recent events across all agents in the ecosystem, with agent context for display.",
    params: [
      {
        name: "limit",
        type: "number",
        required: false,
        description:
          "Maximum number of events to return. Defaults to 20, max 50.",
      },
      {
        name: "chainId",
        type: "number",
        required: false,
        description:
          "Filter events by chain: 1 (Ethereum), 8453 (Base), 56 (BNB Chain), 137 (Polygon), 42161 (Arbitrum). Omit for all chains.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/events/recent?limit=5"`,
    exampleResponse: JSON.stringify(
      [
        {
          event: {
            id: "evt-99",
            agentId: "abc-123",
            txHash: "0xaaa...111",
            blockNumber: 19700000,
            eventType: "AgentRegistered",
            rawData: { tokenId: "42", owner: "0x..." },
            createdAt: "2024-03-01T09:00:00Z",
          },
          agentName: "WeatherBot",
          agentImage: "https://example.com/avatar.png",
          agentErc8004Id: "42",
          agentId: "abc-123",
        },
      ],
      null,
      2
    ),
    responseFields: [
      {
        field: "event",
        description:
          "The full event object with id, txHash, blockNumber, eventType, rawData, and createdAt.",
      },
      {
        field: "agentName",
        description: "The agent's name (null if no metadata resolved).",
      },
      {
        field: "agentImage",
        description: "URL of the agent's avatar image (null if unavailable).",
      },
      {
        field: "agentErc8004Id",
        description: "The agent's on-chain ERC-8004 token ID.",
      },
      {
        field: "agentId",
        description: "The agent's internal UUID for linking to the profile.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/stats",
    description:
      "Get ecosystem-wide statistics including agent counts and indexer status. Optionally filter by chain.",
    params: [
      {
        name: "chainId",
        type: "number",
        required: false,
        description:
          "Get stats for a specific chain. Omit for aggregate stats across all chains.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/stats"`,
    exampleResponse: JSON.stringify(
      {
        totalAgents: 13202,
        totalEvents: 13202,
        lastProcessedBlock: 19750000,
        isIndexerRunning: true,
        lastError: null,
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "totalAgents",
        description: "Total number of discovered agents on-chain.",
      },
      {
        field: "totalEvents",
        description:
          "Total number of on-chain events indexed across all agents.",
      },
      {
        field: "lastProcessedBlock",
        description:
          "The most recent block the indexer has processed (across all chains).",
      },
      {
        field: "isIndexerRunning",
        description: "Whether the indexer is currently active.",
      },
      {
        field: "chainBreakdown",
        description: "Per-chain breakdown with totalAgents, lastProcessedBlock, isRunning, and lastError for each chain.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/chains",
    description:
      "Get the list of configured blockchain networks and their indexing status.",
    exampleCurl: `curl "${BASE_URL}/api/chains"`,
    exampleResponse: JSON.stringify(
      [
        {
          chainId: 1,
          name: "Ethereum",
          shortName: "eth",
          explorerUrl: "https://etherscan.io",
          enabled: true,
          totalAgents: 13202,
          lastProcessedBlock: 21750000,
        },
        {
          chainId: 8453,
          name: "Base",
          shortName: "base",
          explorerUrl: "https://basescan.org",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 25000000,
        },
        {
          chainId: 56,
          name: "BNB Chain",
          shortName: "bnb",
          explorerUrl: "https://bscscan.com",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 46000000,
        },
        {
          chainId: 137,
          name: "Polygon",
          shortName: "polygon",
          explorerUrl: "https://polygonscan.com",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 67000000,
        },
        {
          chainId: 42161,
          name: "Arbitrum",
          shortName: "arb",
          explorerUrl: "https://arbiscan.io",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 290000000,
        },
        {
          chainId: 42220,
          name: "Celo",
          shortName: "celo",
          explorerUrl: "https://celoscan.io",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 58396700,
        },
        {
          chainId: 100,
          name: "Gnosis",
          shortName: "gnosis",
          explorerUrl: "https://gnosisscan.io",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 44505000,
        },
        {
          chainId: 10,
          name: "Optimism",
          shortName: "opt",
          explorerUrl: "https://optimistic.etherscan.io",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 147514900,
        },
        {
          chainId: 43114,
          name: "Avalanche",
          shortName: "avax",
          explorerUrl: "https://snowscan.xyz",
          enabled: true,
          totalAgents: 0,
          lastProcessedBlock: 77389000,
        },
      ],
      null,
      2
    ),
    responseFields: [
      {
        field: "chainId",
        description: "The numeric chain ID (1 = Ethereum, 8453 = Base, 56 = BNB Chain, 137 = Polygon, 42161 = Arbitrum, 42220 = Celo, 100 = Gnosis, 10 = Optimism, 43114 = Avalanche).",
      },
      {
        field: "name",
        description: "Human-readable chain name.",
      },
      {
        field: "enabled",
        description: "Whether the chain is actively being indexed (based on RPC key availability).",
      },
      {
        field: "totalAgents",
        description: "Number of agents discovered on this chain.",
      },
      {
        field: "lastProcessedBlock",
        description: "The most recent block processed by the indexer for this chain.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/trust-scores/top",
    description:
      "Get the top agents by TrustAdd Score. Use for leaderboards and discovering the most active agents in the ecosystem.",
    params: [
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Maximum number of agents to return (default: 20, max: 100).",
      },
      {
        name: "chain",
        type: "number",
        required: false,
        description: "Filter by chain ID (e.g. 1 for Ethereum, 8453 for Base).",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/trust-scores/top?limit=5"`,
    exampleResponse: JSON.stringify(
      [
        {
          id: "abc-123",
          name: "WeatherBot",
          chainId: 1,
          trustScore: 85,
          verdict: "TRUSTED",
          image: "https://example.com/avatar.png",
        },
        {
          id: "def-456",
          name: "DataOracle",
          chainId: 8453,
          trustScore: 78,
          verdict: "TRUSTED",
          image: null,
        },
      ],
      null,
      2
    ),
    responseFields: [
      {
        field: "id",
        description: "The agent's internal UUID.",
      },
      {
        field: "name",
        description: "The agent's name (null if unnamed).",
      },
      {
        field: "trustScore",
        description: "The agent's TrustAdd Score (0-100).",
      },
      {
        field: "verdict",
        description: 'High-level trust signal: "VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN".',
      },
      {
        field: "chainId",
        description: "The chain where this agent is registered.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/trust-scores/distribution",
    description:
      "Get the distribution of TrustAdd Scores across all agents, bucketed in 10-point ranges. Useful for understanding the overall trust landscape.",
    params: [
      {
        name: "chain",
        type: "number",
        required: false,
        description: "Filter by chain ID for chain-specific distribution.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/trust-scores/distribution"`,
    exampleResponse: JSON.stringify(
      [
        { bucket: "0-10", count: 1200 },
        { bucket: "10-20", count: 8500 },
        { bucket: "20-30", count: 5400 },
        { bucket: "30-40", count: 2100 },
        { bucket: "40-50", count: 800 },
        { bucket: "50-60", count: 450 },
        { bucket: "60-70", count: 200 },
        { bucket: "70-80", count: 90 },
        { bucket: "80-90", count: 30 },
        { bucket: "90-100", count: 5 },
      ],
      null,
      2
    ),
    responseFields: [
      {
        field: "bucket",
        description: "The score range (e.g. '0-10', '10-20', ... '90-100').",
      },
      {
        field: "count",
        description: "Number of agents with a score in this range.",
      },
    ],
  },
];

const paidEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/trust/:address/exists",
    gated: true,
    description:
      "Check whether a Trust Report exists for an agent address. Returns availability and pricing without consuming a report credit. Free probe — no x402 payment required.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        description: "The agent's contract address (0x-prefixed).",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/v1/trust/0x1234...abcd/exists"`,
    exampleResponse: JSON.stringify(
      {
        address: "0x1234...abcd",
        exists: true,
        reportAvailable: true,
        price: "$0.01",
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "exists",
        description: "Whether TrustAdd has indexed this agent address.",
      },
      {
        field: "reportAvailable",
        description: "Whether a full Trust Report can be retrieved for this address.",
      },
      {
        field: "price",
        description: "The cost to retrieve a full Trust Report for this address.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/trust/:address",
    gated: true,
    description:
      "Get the trust verdict and score for an agent address. Returns the verdict, TrustAdd Score, and report availability. Requires x402 micropayment (from $0.01). Returns HTTP 402 with payment details if no payment is provided.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        description: "The agent's contract address (0x-prefixed).",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/v1/trust/0x1234...abcd"`,
    exampleResponse: JSON.stringify(
      {
        address: "0x1234...abcd",
        verdict: "TRUSTED",
        score: 82,
        reportAvailable: true,
        cachedUntil: "2026-04-13T00:00:00.000Z",
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "address",
        description: "The queried agent contract address.",
      },
      {
        field: "verdict",
        description: 'Trust verdict: "VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN".',
      },
      {
        field: "score",
        description: "The composite TrustAdd Score (0-100).",
      },
      {
        field: "reportAvailable",
        description: "Whether the full report endpoint is available for this address.",
      },
      {
        field: "cachedUntil",
        description: "Timestamp until which this response may be served from cache.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/trust/:address/report",
    gated: true,
    description:
      "Get the full Agent Trust Report for an address. Includes trust score breakdown (identity, history, capability, community, transparency), community signals, on-chain transaction history, spam flags, and a detailed verdict. Requires x402 micropayment (from $0.01). Returns HTTP 402 with payment details if no payment is provided.",
    params: [
      {
        name: "address",
        type: "string",
        required: true,
        description: "The agent's contract address (0x-prefixed).",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/v1/trust/0x1234...abcd/report"`,
    exampleResponse: JSON.stringify(
      {
        address: "0x1234...abcd",
        verdict: "TRUSTED",
        score: 82,
        breakdown: {
          total: 82,
          identity: 22,
          history: 18,
          capability: 14,
          community: 16,
          transparency: 12,
        },
        qualityTier: "high",
        spamFlags: [],
        communitySignals: {
          githubScore: 74,
          farcasterEngagement: 12,
          onChainFeedbackCount: 3,
        },
        transactionSummary: {
          totalTransactions: 47,
          uniquePayers: 31,
          volumeUsdApprox: "312.00",
        },
        generatedAt: "2026-04-12T10:00:00.000Z",
        cachedUntil: "2026-04-13T00:00:00.000Z",
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "verdict",
        description: 'Trust verdict: "VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED", or "UNKNOWN".',
      },
      {
        field: "score",
        description: "The composite TrustAdd Score (0-100).",
      },
      {
        field: "breakdown",
        description: "Category scores: identity (0-25), history (0-20), capability (0-15), community (0-20), transparency (0-20).",
      },
      {
        field: "qualityTier",
        description: 'Agent quality classification: "high", "medium", "low", or "minimal".',
      },
      {
        field: "spamFlags",
        description: "Array of spam or abuse signal strings identified for this agent.",
      },
      {
        field: "communitySignals",
        description: "Aggregated community reputation data including GitHub health score, Farcaster engagement, and on-chain feedback count.",
      },
      {
        field: "transactionSummary",
        description: "Summary of x402 payment activity: total transactions, unique payers, and approximate USD volume.",
      },
      {
        field: "cachedUntil",
        description: "Timestamp until which this report may be served from cache.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/agents/:id/history",
    gated: true,
    description:
      "Get the complete on-chain event history for a specific agent. Available as part of the Agent Trust Report — access via /api/v1/trust/:address/report or request directly with x402 payment.",
    params: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "The internal UUID of the agent.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/agents/abc-123/history"`,
    exampleResponse: JSON.stringify(
      [
        {
          id: "evt-1",
          agentId: "abc-123",
          txHash: "0xdef...789",
          blockNumber: 19500000,
          eventType: "AgentRegistered",
          rawData: {},
          createdAt: "2024-01-15T10:30:00Z",
        },
        {
          id: "evt-2",
          agentId: "abc-123",
          txHash: "0xghi...012",
          blockNumber: 19600000,
          eventType: "MetadataUpdated",
          rawData: {},
          createdAt: "2024-02-20T14:15:00Z",
        },
      ],
      null,
      2
    ),
    responseFields: [
      {
        field: "eventType",
        description:
          'The type of on-chain event: "AgentRegistered", "MetadataUpdated", "FeedbackPosted", "ReputationUpdated", "EndorsementAdded", or "IdentityUpdated".',
      },
      {
        field: "txHash",
        description: "The transaction hash for this event on its respective chain.",
      },
      {
        field: "blockNumber",
        description: "The block number when this event occurred on its respective chain.",
      },
      {
        field: "rawData",
        description:
          "The raw event data from the blockchain, varies by event type.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/agents/:id/feedback",
    gated: true,
    description:
      "Get the reputation feedback summary for a specific agent, including feedback counts, unique reviewers, and individual feedback events. Available as part of the Agent Trust Report.",
    params: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "The internal UUID of the agent.",
      },
    ],
    exampleCurl: `curl "${BASE_URL}/api/agents/abc-123/feedback"`,
    exampleResponse: JSON.stringify(
      {
        feedbackCount: 3,
        uniqueReviewers: 2,
        firstFeedbackBlock: 19500000,
        lastFeedbackBlock: 19700000,
        events: [
          {
            id: "evt-10",
            agentId: "abc-123",
            txHash: "0xfeed...back",
            blockNumber: 19700000,
            eventType: "FeedbackPosted",
            rawData: {
              reviewer: "0xabcd...1234",
              feedbackHash: "0x...",
              feedbackURI: "ipfs://Qm...",
            },
            createdAt: "2024-03-01T09:00:00Z",
          },
        ],
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "feedbackCount",
        description: "Total number of feedback/reputation events for this agent.",
      },
      {
        field: "uniqueReviewers",
        description: "Number of unique reviewer addresses who provided feedback.",
      },
      {
        field: "firstFeedbackBlock",
        description: "Block number of the earliest feedback event (null if none).",
      },
      {
        field: "lastFeedbackBlock",
        description: "Block number of the most recent feedback event (null if none).",
      },
      {
        field: "events",
        description: "Array of individual feedback/reputation event objects.",
      },
    ],
  },
  {
    method: "GET",
    path: "/api/agents/:id/trust-score",
    gated: true,
    description:
      "Get the TrustAdd Score breakdown for a specific agent. The score is a composite 0-100 metric based on identity, history, capability, community, and transparency signals. Available as part of the Agent Trust Report.",
    exampleCurl: `curl "${BASE_URL}/api/agents/{id}/trust-score"`,
    exampleResponse: JSON.stringify(
      {
        score: 62,
        breakdown: {
          total: 62,
          identity: 20,
          history: 12,
          capability: 10,
          community: 10,
          transparency: 10,
        },
        updatedAt: "2026-02-28T12:00:00.000Z",
      },
      null,
      2
    ),
    responseFields: [
      {
        field: "score",
        description: "The composite TrustAdd Score (0-100).",
      },
      {
        field: "breakdown",
        description: "Category scores: identity (0-25), history (0-20), capability (0-15), community (0-20), transparency (0-20).",
      },
      {
        field: "updatedAt",
        description: "When the score was last calculated.",
      },
    ],
  },
];

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const styles =
    method === "GET"
      ? "bg-green-500/15 text-green-700 dark:text-green-400 no-default-hover-elevate no-default-active-elevate"
      : "bg-blue-500/15 text-blue-700 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate";

  return (
    <Badge className={styles} data-testid={`badge-method-${method}`}>
      {method}
    </Badge>
  );
}

function EndpointCard({ endpoint, index }: { endpoint: Endpoint; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-endpoint-${index}`}>
        <CollapsibleTrigger className="w-full text-left p-4 flex items-center gap-3 cursor-pointer" data-testid={`button-toggle-endpoint-${index}`}>
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono font-medium flex-1">
            {endpoint.path}
          </code>
          {endpoint.gated && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
              <Lock className="w-3 h-3" />
              x402
            </span>
          )}
          <span className="text-sm text-muted-foreground hidden sm:block max-w-xs truncate">
            {endpoint.description}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            <p className="text-sm text-muted-foreground" data-testid={`text-description-${index}`}>
              {endpoint.description}
            </p>

            {endpoint.params && endpoint.params.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid={`table-params-${index}`}>
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Required</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.params.map((param) => (
                        <tr key={param.name} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-md">
                              {param.name}
                            </code>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {param.type}
                          </td>
                          <td className="py-2 pr-4">
                            {param.required ? (
                              <Badge className="text-[10px] bg-primary/15 text-primary no-default-hover-elevate no-default-active-elevate">
                                Required
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Optional</span>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {param.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold">Example Request</h4>
                <CopyButton text={endpoint.exampleCurl} id={`curl-${index}`} />
              </div>
              <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all" data-testid={`code-curl-${index}`}>
                {endpoint.exampleCurl}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold">Example Response</h4>
                <CopyButton text={endpoint.exampleResponse} id={`response-${index}`} />
              </div>
              <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto" data-testid={`code-response-${index}`}>
                {endpoint.exampleResponse}
              </pre>
            </div>

            {endpoint.responseFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Response Fields</h4>
                <div className="space-y-1.5">
                  {endpoint.responseFields.map((rf) => (
                    <div key={rf.field} className="flex items-start gap-2">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-md flex-shrink-0">
                        {rf.field}
                      </code>
                      <span className="text-sm text-muted-foreground">
                        {rf.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function ApiDocs() {
  const { copiedKey, copy } = useClipboard();
  const baseUrl = "https://trustadd.com";
  const isBaseUrlCopied = copiedKey === "base-url";

  return (
    <Layout>
      <SEO
        title={API_DOCS.seo.title}
        description={API_DOCS.seo.description}
        path="/api-docs"
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:py-20">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Developer Resources
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter leading-tight" data-testid="text-api-docs-title">
            Public API
          </h1>

          <p className="text-base text-muted-foreground mt-4 max-w-lg leading-relaxed" data-testid="text-api-docs-intro">
            {API_DOCS.intro}
          </p>

          <div className="mt-6">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Base URL
            </span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <code
                className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md"
                data-testid="text-base-url"
              >
                {baseUrl}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copy(baseUrl, "base-url")}
                data-testid="button-copy-base-url"
              >
                {isBaseUrlCopied ? (
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-endpoints-heading">
            Free Tier — Ecosystem Analytics
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          No authentication required. Agent discovery, ecosystem stats, and marketplace data are open to all.
        </p>

        <div className="space-y-3 mb-10" data-testid="list-endpoints-free">
          {freeEndpoints.map((endpoint, i) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} index={i} />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-amber-500" />
          <h2 className="text-lg font-semibold tracking-tight" data-testid="text-endpoints-paid-heading">
            Paid Tier — Agent Trust Reports (x402)
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Agent-specific trust intelligence is gated behind an x402 micropayment, from $0.01 per query. Endpoints return HTTP 402 with payment instructions when no valid payment is provided. Compatible with any x402-capable client.
        </p>

        <div className="space-y-3" data-testid="list-endpoints-paid">
          {paidEndpoints.map((endpoint, i) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} index={freeEndpoints.length + i} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8 pb-16">
        <Card className="p-5" data-testid="card-usage-notes">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Usage Notes</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>All endpoints return JSON. Free tier endpoints require no authentication.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>Free tier is rate limited to 100 requests per minute per IP. <code className="font-mono bg-muted px-1 rounded-md">/api/agents</code> is additionally limited to 10 requests per minute with a max of 20 results per page. Exceeding limits returns a <code className="font-mono bg-muted px-1 rounded-md">429</code> status.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>x402-gated endpoints return HTTP 402 with a <code className="font-mono bg-muted px-1 rounded-md">X-Payment-Required</code> header describing the accepted payment methods and amount when no valid payment is attached.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>{API_DOCS.usageNotes.dataSource.split("chainId")[0]}<code className="font-mono bg-muted px-1 rounded-md">chainId</code> parameter to filter by chain.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>The <code className="font-mono bg-muted px-1 rounded-md">rawData</code> field in events contains the original on-chain event parameters and varies by event type.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
              <span>CORS is enabled for all origins. You can call these endpoints directly from browser-based applications.</span>
            </li>
          </ul>
        </Card>
      </section>
    </Layout>
  );
}
