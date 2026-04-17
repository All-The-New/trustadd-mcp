import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAgentTrustGatePrompt } from "./agent-trust-gate.js";

export function registerAllPrompts(server: McpServer): void {
  registerAgentTrustGatePrompt(server);
}
