import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api.js";
import { errorResult, textResult } from "../lib/responses.js";
import { apiPath, API_VERSIONS } from "../lib/versioning.js";

export function registerStatusTools(server: McpServer): void {
  server.registerTool(
    "trustadd_status",
    {
      description:
        "Get TrustAdd service health + pipeline circuit-breaker status. " +
        "Returns API health, DB connectivity, indexer pipeline health, and the API " +
        "version the MCP server is currently targeting. Use for debugging when other " +
        "tools return unexpected errors. Free endpoint.",
      inputSchema: {},
    },
    async () => {
      try {
        const [health, pipeline] = await Promise.all([
          apiGet(apiPath("status", "/health")),
          apiGet(apiPath("trust", "/pipeline-health")),
        ]);
        return textResult({
          health: health.status === 200 ? health.data : { status: "unreachable", code: health.status },
          pipeline: pipeline.status === 200 ? pipeline.data : { status: "unreachable", code: pipeline.status },
          mcpApiVersions: API_VERSIONS,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
