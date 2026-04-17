import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerTrustTools } from "../../src/tools/trust.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("trust tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerTrustTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 3 trust tools", () => {
    expect(server.tools.has("lookup_agent")).toBe(true);
    expect(server.tools.has("check_agent_trust")).toBe(true);
    expect(server.tools.has("get_trust_report")).toBe(true);
  });

  it("lookup_agent calls /api/v1/trust/{addr}/exists", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ found: true, verdict: "TRUSTED" }) });
    const tool = server.tools.get("lookup_agent")!;
    await tool.handler({ address: "0x0000000000000000000000000000000000000001" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/trust/0x0000000000000000000000000000000000000001/exists"),
      expect.anything()
    );
  });

  it("check_agent_trust includes chainId query when provided", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ score: 85 }) });
    const tool = server.tools.get("check_agent_trust")!;
    await tool.handler({ address: "0x0000000000000000000000000000000000000002", chainId: 8453 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/trust/0x0000000000000000000000000000000000000002?chainId=8453"),
      expect.anything()
    );
  });

  it("get_trust_report returns payment-required on 402", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 402, json: async () => ({}) });
    const tool = server.tools.get("get_trust_report")!;
    const result = await tool.handler({ address: "0x0000000000000000000000000000000000000003" });
    expect(result.content[0].text).toContain("paymentRequired");
  });
});
