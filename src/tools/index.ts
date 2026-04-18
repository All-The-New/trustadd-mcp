import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTrustTools } from "./trust.js";
import { registerMppTools } from "./mpp.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerStatusTools } from "./status.js";

export function registerAllTools(server: McpServer): void {
  registerTrustTools(server);
  registerMppTools(server);
  registerAnalyticsTools(server);
  registerStatusTools(server);
}
