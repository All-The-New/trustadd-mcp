#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.TRUSTADD_API_URL || "https://trustadd.com";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const server = new McpServer({
  name: "trustadd",
  version: "1.0.0",
});

// --- Helpers ---

async function apiGet(path: string): Promise<{ status: number; data: unknown; headers: Headers }> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

// --- Tool 1: Free lookup ---

server.registerTool(
  "lookup_agent",
  {
    description:
      "Check if TrustAdd has trust data for an AI agent address. Free, no payment required. " +
      "Returns whether the agent is found, a verdict preview (TRUSTED/CAUTION/UNTRUSTED/UNKNOWN), " +
      "and pricing for paid endpoints. Use this before check_agent_trust to see if data exists.",
    inputSchema: {
      address: z
        .string()
        .regex(ADDRESS_RE)
        .describe("EVM address (0x-prefixed, 40 hex chars) — contract, controller, or payment address"),
    },
  },
  async ({ address }) => {
    try {
      const { status, data } = await apiGet(`/api/v1/trust/${address}/exists`);
      if (status === 400) return errorResult("Invalid address format");
      if (status >= 500) return errorResult(`TrustAdd API error (HTTP ${status})`);
      return textResult(data);
    } catch (err) {
      return errorResult(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// --- Tool 2: Quick Check (x402-gated) ---

server.registerTool(
  "check_agent_trust",
  {
    description:
      "Get a trust verdict for an AI agent. Returns score (0-100), verdict (TRUSTED/CAUTION/UNTRUSTED), " +
      "score breakdown across 5 categories, flags, and key metrics. " +
      "Costs $0.01 USDC on Base via x402 protocol. " +
      "If x402 payment is not configured, returns the 402 payment requirements so you can inform the user. " +
      "Use lookup_agent first to check if data exists (free).",
    inputSchema: {
      address: z
        .string()
        .regex(ADDRESS_RE)
        .describe("EVM address to check trust for"),
      chainId: z
        .number()
        .optional()
        .describe("Optional chain ID to narrow lookup (e.g. 8453 for Base, 1 for Ethereum)"),
    },
  },
  async ({ address, chainId }) => {
    try {
      const params = chainId ? `?chainId=${chainId}` : "";
      const { status, data } = await apiGet(`/api/v1/trust/${address}${params}`);

      if (status === 402) {
        return textResult({
          paymentRequired: true,
          message:
            "This endpoint requires x402 payment ($0.01 USDC on Base). " +
            "The TrustAdd MCP server does not handle x402 payments directly — " +
            "use the REST API with an x402-compatible HTTP client, or visit trustadd.com.",
          details: data,
        });
      }
      if (status === 404) return textResult({ verdict: "UNKNOWN", message: "No agent found for this address" });
      if (status === 400) return errorResult("Invalid address format");
      if (status >= 500) return errorResult(`TrustAdd API error (HTTP ${status})`);
      return textResult(data);
    } catch (err) {
      return errorResult(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// --- Tool 3: Full Report (x402-gated) ---

server.registerTool(
  "get_trust_report",
  {
    description:
      "Get a comprehensive trust report for an AI agent with full evidence: " +
      "identity details, on-chain history across 9 chains, economic activity (x402 payments, transaction volume), " +
      "community signals (GitHub health, Farcaster engagement), and data freshness metadata. " +
      "Costs $0.05 USDC on Base via x402 protocol. " +
      "Use check_agent_trust ($0.01) for a quick verdict, or this tool for detailed due diligence.",
    inputSchema: {
      address: z
        .string()
        .regex(ADDRESS_RE)
        .describe("EVM address to get full trust report for"),
      chainId: z
        .number()
        .optional()
        .describe("Optional chain ID to narrow lookup"),
    },
  },
  async ({ address, chainId }) => {
    try {
      const params = chainId ? `?chainId=${chainId}` : "";
      const { status, data } = await apiGet(`/api/v1/trust/${address}/report${params}`);

      if (status === 402) {
        return textResult({
          paymentRequired: true,
          message:
            "This endpoint requires x402 payment ($0.05 USDC on Base). " +
            "The TrustAdd MCP server does not handle x402 payments directly — " +
            "use the REST API with an x402-compatible HTTP client, or visit trustadd.com.",
          details: data,
        });
      }
      if (status === 404) return textResult({ verdict: "UNKNOWN", message: "No agent found for this address" });
      if (status === 400) return errorResult("Invalid address format");
      if (status >= 500) return errorResult(`TrustAdd API error (HTTP ${status})`);
      return textResult(data);
    } catch (err) {
      return errorResult(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
