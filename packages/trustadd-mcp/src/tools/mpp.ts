import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { freeHandler } from "../lib/api.js";
import { apiPath } from "../lib/versioning.js";

export function registerMppTools(server: McpServer): void {
  server.registerTool(
    "mpp_directory_stats",
    {
      description:
        "Get aggregate statistics for the Multi-Protocol Payment (MPP) directory: " +
        "total services, active services, provider count, category breakdown. " +
        "Free endpoint. Use to understand the MPP ecosystem size and composition.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/directory/stats"))
  );

  server.registerTool(
    "mpp_adoption_stats",
    {
      description:
        "Get cross-protocol payment adoption counts: how many agents support MPP, " +
        "how many support x402, and how many support both. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/adoption"))
  );

  server.registerTool(
    "mpp_chain_stats",
    {
      description:
        "Get Tempo chain (MPP settlement layer) aggregate stats: pathUSD transaction volume, " +
        "transaction count, unique payers, active recipients. Free endpoint.",
      inputSchema: {},
    },
    async () => freeHandler(apiPath("mpp", "/chain/stats"))
  );

  server.registerTool(
    "mpp_search_services",
    {
      description:
        "Search the MPP directory services registry. Supports filtering by category, " +
        "payment method, and free-text search. Returns paginated results. Free endpoint.",
      inputSchema: {
        category: z.string().optional().describe("Filter by service category (e.g. 'ai', 'data')"),
        paymentMethod: z.string().optional().describe("Filter by payment method (e.g. 'usdc')"),
        search: z.string().optional().describe("Free-text search across service names + descriptions"),
        page: z.number().int().min(1).max(100_000).optional().describe("Page number (default 1)"),
        limit: z.number().int().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      },
    },
    async ({ category, paymentMethod, search, page, limit }) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (search) params.set("search", search);
      if (page !== undefined) params.set("page", String(page));
      if (limit !== undefined) params.set("limit", String(limit));
      const qs = params.toString();
      return freeHandler(apiPath("mpp", `/directory/services${qs ? `?${qs}` : ""}`));
    }
  );
}
