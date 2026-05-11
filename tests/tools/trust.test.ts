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

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TRUSTADD_API_KEY;
  });

  it("registers 3 trust tools", () => {
    expect(server.tools.has("lookup_agent")).toBe(true);
    expect(server.tools.has("check_agent_trust")).toBe(true);
    expect(server.tools.has("get_trust_report")).toBe(true);
  });

  it("none of the descriptions mention price or x402", () => {
    for (const [, entry] of server.tools.entries()) {
      const desc = entry.config.description ?? "";
      expect(desc).not.toMatch(/\$0\.0|x402|payment required|paid|paywall/i);
    }
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

  it("forwards Authorization: Bearer when TRUSTADD_API_KEY is set", async () => {
    process.env.TRUSTADD_API_KEY = "test_bearer_xyz";
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ score: 85 }) });
    const tool = server.tools.get("check_agent_trust")!;
    await tool.handler({ address: "0x0000000000000000000000000000000000000003" });
    const headers = (spy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test_bearer_xyz");
  });

  it("get_trust_report returns a registration-hint error on 429 (anonymous)", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 429, json: async () => null });
    const tool = server.tools.get("get_trust_report")!;
    const result = await tool.handler({ address: "0x0000000000000000000000000000000000000004" });
    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toMatch(/register|API key/i);
  });

  it("get_trust_report returns parsed data on 200", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ agent: { name: "ExampleAgent" }, scoreBreakdown: { total: 72 } }),
    });
    const tool = server.tools.get("get_trust_report")!;
    const result = await tool.handler({ address: "0x0000000000000000000000000000000000000005" });
    expect(result.content[0].text).toContain("ExampleAgent");
  });
});
