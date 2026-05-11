import { describe, it, expect } from "vitest";
import { registerAgentTrustGatePrompt } from "../../src/prompts/agent-trust-gate.js";

function fakeServer() {
  const prompts = new Map<string, { config: any; handler: Function }>();
  return {
    registerPrompt(name: string, config: any, handler: Function) {
      prompts.set(name, { config, handler });
    },
    prompts,
  };
}

describe("agent_trust_gate prompt", () => {
  it("registers under name agent_trust_gate", () => {
    const server = fakeServer();
    registerAgentTrustGatePrompt(server as any);
    expect(server.prompts.has("agent_trust_gate")).toBe(true);
  });

  it("renders without price or x402 language", () => {
    const server = fakeServer();
    registerAgentTrustGatePrompt(server as any);
    const entry = server.prompts.get("agent_trust_gate")!;
    const rendered = entry.handler({ counterparty: "0xabc", context: "send 50 USDC" });
    const text = rendered.messages[0].content.text as string;
    expect(text).not.toMatch(/\$0\.0/);
    expect(text).not.toMatch(/x402/i);
    expect(text).not.toMatch(/payment[- ]required/i);
    expect(text).not.toMatch(/\b402\b/);
  });

  it("guides through lookup → check → optional report flow", () => {
    const server = fakeServer();
    registerAgentTrustGatePrompt(server as any);
    const entry = server.prompts.get("agent_trust_gate")!;
    const rendered = entry.handler({ counterparty: "0xabc" });
    const text = rendered.messages[0].content.text as string;
    expect(text).toContain("lookup_agent");
    expect(text).toContain("check_agent_trust");
    expect(text).toContain("get_trust_report");
  });

  it("mentions all 5 verdict tiers", () => {
    const server = fakeServer();
    registerAgentTrustGatePrompt(server as any);
    const entry = server.prompts.get("agent_trust_gate")!;
    const rendered = entry.handler({ counterparty: "0xabc" });
    const text = rendered.messages[0].content.text as string;
    for (const tier of ["VERIFIED", "TRUSTED", "BUILDING", "INSUFFICIENT", "FLAGGED"]) {
      expect(text).toContain(tier);
    }
  });
});
