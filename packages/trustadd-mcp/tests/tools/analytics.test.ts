import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAnalyticsTools } from "../../src/tools/analytics.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("analytics tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerAnalyticsTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 3 analytics tools", () => {
    expect(server.tools.has("ecosystem_overview")).toBe(true);
    expect(server.tools.has("chain_distribution")).toBe(true);
    expect(server.tools.has("list_supported_chains")).toBe(true);
  });

  it("ecosystem_overview calls /api/analytics/overview", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ totalAgents: 102_000 }) });
    await server.tools.get("ecosystem_overview")!.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/analytics/overview"),
      expect.anything()
    );
  });

  it("list_supported_chains calls /api/chains", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => [] });
    await server.tools.get("list_supported_chains")!.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/chains"),
      expect.anything()
    );
  });
});
