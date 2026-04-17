import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerMppTools } from "../../src/tools/mpp.js";

function fakeServer() {
  const tools = new Map<string, { config: any; handler: Function }>();
  return {
    registerTool(name: string, config: any, handler: Function) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe("mpp tools", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    registerMppTools(server as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers 4 MPP tools", () => {
    expect(server.tools.has("mpp_directory_stats")).toBe(true);
    expect(server.tools.has("mpp_adoption_stats")).toBe(true);
    expect(server.tools.has("mpp_chain_stats")).toBe(true);
    expect(server.tools.has("mpp_search_services")).toBe(true);
  });

  it("mpp_directory_stats calls /api/mpp/directory/stats", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ totalServices: 42 }) });
    const tool = server.tools.get("mpp_directory_stats")!;
    const result = await tool.handler({});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/mpp/directory/stats"),
      expect.anything()
    );
    expect(result.content[0].text).toContain("42");
  });

  it("mpp_search_services passes query params", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ services: [] }) });
    const tool = server.tools.get("mpp_search_services")!;
    await tool.handler({ category: "ai", paymentMethod: "usdc", search: "bot", page: 2, limit: 20 });
    const call = spy.mock.calls[0][0];
    expect(call).toContain("/api/mpp/directory/services");
    expect(call).toContain("category=ai");
    expect(call).toContain("paymentMethod=usdc");
    expect(call).toContain("search=bot");
    expect(call).toContain("page=2");
    expect(call).toContain("limit=20");
  });

  it("mpp_search_services works with no params", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({ services: [] }) });
    const tool = server.tools.get("mpp_search_services")!;
    await tool.handler({});
    expect(spy).toHaveBeenCalled();
  });
});
