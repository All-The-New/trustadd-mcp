import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTrustTools } from "./trust.js";
import { registerMppTools } from "./mpp.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerStatusTools } from "./status.js";

/**
 * Register every tool group with the MCP server.
 *
 * To add a new tool group:
 *   1. Create `src/tools/<group>.ts` exporting `register<Group>Tools(server)`.
 *   2. Import and call it below.
 *   3. Add any new API group to `src/lib/versioning.ts` if the group uses a new URL prefix.
 */
export function registerAllTools(server: McpServer): void {
  registerTrustTools(server);
  registerMppTools(server);
  registerAnalyticsTools(server);
  registerStatusTools(server);
}
