import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AddressSchema } from "../lib/schemas.js";

export function registerAgentTrustGatePrompt(server: McpServer): void {
  server.registerPrompt(
    "agent_trust_gate",
    {
      description:
        "Walk the caller through a trust-gated decision for transacting with an unknown AI agent. " +
        "Uses lookup_agent → check_agent_trust → optional get_trust_report to produce a proceed/abort " +
        "recommendation. All tools are free; set TRUSTADD_API_KEY for higher rate limits.",
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
              `1. Call lookup_agent with address=${counterparty}. If found=false, the agent is unknown to TrustAdd — warn the user and recommend caution.\n` +
              `2. If found, call check_agent_trust with address=${counterparty} to retrieve the score and verdict.\n` +
              `3. Based on the verdict (TrustAdd uses 5 tiers: VERIFIED ≥80, TRUSTED ≥60, BUILDING ≥20, INSUFFICIENT <20, FLAGGED=active negative evidence):\n` +
              `   - VERIFIED (score ≥ 80): proceed confidently, cite the score.\n` +
              `   - TRUSTED (score ≥ 60): proceed, briefly cite the score and any flags.\n` +
              `   - BUILDING (score ≥ 20): call get_trust_report for detailed evidence and summarize risk factors before deciding.\n` +
              `   - INSUFFICIENT (score < 20) or FLAGGED: recommend the user abort or use extreme caution. Cite the top red flags from the breakdown.\n` +
              `   - Agent not found (UNKNOWN): recommend caution and small-amount testing.\n` +
              `4. Always include the score, verdict, and any flags in your summary.\n` +
              `5. If you hit a rate limit, suggest the user register for a free API key at https://trustadd.com/register and set TRUSTADD_API_KEY.\n` +
              `\nStart with step 1.`,
          },
        },
      ],
    })
  );
}
