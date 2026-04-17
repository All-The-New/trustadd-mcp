import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AddressSchema } from "../lib/schemas.js";

export function registerAgentTrustGatePrompt(server: McpServer): void {
  server.registerPrompt(
    "agent_trust_gate",
    {
      description:
        "Walk the caller through a trust-gated decision for transacting with an unknown AI agent. " +
        "Uses lookup_agent (free) → check_agent_trust ($0.01) → optional get_trust_report ($0.05) " +
        "to produce a proceed/abort recommendation.",
      argsSchema: {
        counterparty: AddressSchema,
        context: z
          .string()
          .optional()
          .describe("Optional: what the user wants to do with this agent (e.g. 'send 50 USDC for a data query')"),
      },
    },
    ({ counterparty, context }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `You are about to transact with the AI agent at address ${counterparty}.` +
              (context ? ` Context: ${context}.` : "") +
              `\n\nRun the trust gate:\n` +
              `1. Call lookup_agent with address=${counterparty} (free). If found=false, the agent is unknown — warn the user.\n` +
              `2. If found, call check_agent_trust with address=${counterparty} ($0.01). If the verdict is 402 (payment-required), inform the user and stop.\n` +
              `3. Based on the verdict:\n` +
              `   - TRUSTED (score ≥ 80): proceed, briefly cite the score.\n` +
              `   - CAUTION (score 40–79): call get_trust_report for detailed evidence ($0.05) and summarize risk factors before deciding.\n` +
              `   - UNTRUSTED (score < 40): recommend the user abort. Cite the top red flags from the breakdown.\n` +
              `   - UNKNOWN: recommend caution and small-amount testing.\n` +
              `4. Always include the score, verdict, and any flags in your summary.\n` +
              `\nStart with step 1.`,
          },
        },
      ],
    })
  );
}
