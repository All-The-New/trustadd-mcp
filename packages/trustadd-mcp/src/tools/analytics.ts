import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { freeHandler } from "../lib/api.js";
import { apiPath } from "../lib/versioning.js";

export function registerAnalyticsTools(server: McpServer): void {
  server.registerTool(
    "ecosystem_overview",
    {
      description:
        "Get aggregate ecosystem metrics: total registered agents, active agents, " +
        "cross-chain count, recent registration trend, quality tier distribution. " +
        "Free endpoint. Good starting point for ecosystem-level research.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("analytics", "/overview"))
  );

  server.registerTool(
    "chain_distribution",
    {
      description:
        "Get agent registration counts grouped by chain. Returns per-chain agent totals " +
        "and recent activity. Useful for understanding chain adoption. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("analytics", "/chain-distribution"))
  );

  server.registerTool(
    "list_supported_chains",
    {
      description:
        "List all chains TrustAdd currently indexes, with chain metadata (id, name, " +
        "native token, explorer URL). Use this to discover valid chainId values for " +
        "other tools. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("status", "/chains"))
  );
}
