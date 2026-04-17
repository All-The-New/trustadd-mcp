import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, formatError, paidHandler } from "../lib/api.js";
import { errorResult } from "../lib/responses.js";
import { apiPath } from "../lib/versioning.js";
import { AddressSchema, ChainIdSchema } from "../lib/schemas.js";

export function registerTrustTools(server: McpServer): void {
  server.registerTool(
    "lookup_agent",
    {
      description:
        "Check if TrustAdd has trust data for an AI agent address. Free, no payment required. " +
        "Returns whether the agent is found, a verdict preview (VERIFIED/TRUSTED/BUILDING/INSUFFICIENT/FLAGGED), " +
        "and pricing for paid endpoints. Use this before check_agent_trust to see if data exists.",
      inputSchema: { address: AddressSchema },
    },
    async ({ address }) => {
      try {
        const { status, data } = await apiGet(apiPath("trust", `/${address}/exists`));
        if (status === 400) return errorResult("Invalid address format");
        if (status >= 500) return errorResult(`TrustAdd API error (HTTP ${status})`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );

  server.registerTool(
    "check_agent_trust",
    {
      description:
        "Get a trust verdict for an AI agent. Returns score (0-100), verdict (VERIFIED ≥80 / TRUSTED ≥60 / BUILDING ≥20 / INSUFFICIENT <20 / FLAGGED), " +
        "score breakdown across 5 categories, flags, and key metrics. " +
        "Costs $0.01 USDC on Base via x402 protocol. " +
        "If x402 payment is not configured, returns the 402 payment requirements so you can inform the user. " +
        "Use lookup_agent first to check if data exists (free).",
      inputSchema: {
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await paidHandler(apiPath("trust", `/${address}${qs}`), "$0.01");
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );

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
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await paidHandler(apiPath("trust", `/${address}/report${qs}`), "$0.05");
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );
}
