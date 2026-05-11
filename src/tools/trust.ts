// packages/trustadd-mcp/src/tools/trust.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiHandler, formatError } from "../lib/api.js";
import { errorResult } from "../lib/responses.js";
import { apiPath } from "../lib/versioning.js";
import { AddressSchema, ChainIdSchema } from "../lib/schemas.js";

export function registerTrustTools(server: McpServer): void {
  server.registerTool(
    "lookup_agent",
    {
      description:
        "Check if TrustAdd has trust data for an AI agent address. " +
        "Returns whether the agent is indexed, a verdict preview (VERIFIED/TRUSTED/BUILDING/INSUFFICIENT/FLAGGED), " +
        "and basic metadata. Free; subject to anonymous rate limits — set TRUSTADD_API_KEY for higher quotas.",
      inputSchema: { address: AddressSchema },
    },
    async ({ address }) => {
      try {
        return await apiHandler(apiPath("trust", `/${address}/exists`), { notFoundReturnsUnknown: false });
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );

  server.registerTool(
    "check_agent_trust",
    {
      description:
        "Get a trust verdict for an AI agent. Returns score (0-100), verdict " +
        "(VERIFIED ≥80 / TRUSTED ≥60 / BUILDING ≥20 / INSUFFICIENT <20 / FLAGGED), " +
        "score breakdown across 5 categories (profile, transactions, longevity, community, reputation), " +
        "flags, and key metrics. Free; subject to anonymous rate limits — set TRUSTADD_API_KEY for higher quotas. " +
        "Use lookup_agent first for a cheap existence check.",
      inputSchema: {
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await apiHandler(apiPath("trust", `/${address}${qs}`), { notFoundReturnsUnknown: true });
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
        "identity details, on-chain history across 9 chains, economic activity (payment volume, transactions), " +
        "community signals (GitHub health, Farcaster engagement), and data freshness metadata. " +
        "Free; subject to anonymous rate limits — set TRUSTADD_API_KEY for higher quotas. " +
        "Use check_agent_trust for a quick verdict or this tool for detailed due diligence.",
      inputSchema: {
        address: AddressSchema,
        chainId: ChainIdSchema.optional(),
      },
    },
    async ({ address, chainId }) => {
      try {
        const qs = chainId ? `?chainId=${chainId}` : "";
        return await apiHandler(apiPath("trust", `/${address}/report${qs}`), { notFoundReturnsUnknown: true });
      } catch (err) {
        return errorResult(formatError(err));
      }
    }
  );
}
