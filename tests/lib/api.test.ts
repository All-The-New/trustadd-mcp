// packages/trustadd-mcp/tests/lib/api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiHandler, formatError } from "../../src/lib/api.js";

describe("apiGet", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TRUSTADD_API_URL;
    delete process.env.TRUSTADD_API_KEY;
  });

  it("returns status + parsed JSON on success", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true }),
    });
    const res = await apiGet("/test");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it("returns null data when response is not JSON", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 500,
      json: async () => { throw new Error("invalid"); },
    });
    const res = await apiGet("/test");
    expect(res.status).toBe(500);
    expect(res.data).toBeNull();
  });

  it("uses TRUSTADD_API_URL when set", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    process.env.TRUSTADD_API_URL = "https://staging.trustadd.com";
    await apiGet("/foo");
    expect(spy).toHaveBeenCalledWith(
      "https://staging.trustadd.com/foo",
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("sends Authorization: Bearer when TRUSTADD_API_KEY is set", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    process.env.TRUSTADD_API_KEY = "test_bearer_xyz";
    await apiGet("/foo");
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test_bearer_xyz" }),
      })
    );
  });

  it("omits Authorization header when TRUSTADD_API_KEY is unset", async () => {
    const spy = globalThis.fetch as any;
    spy.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    await apiGet("/foo");
    const call = spy.mock.calls[0];
    const headers = (call[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("formatError", () => {
  it("formats timeout errors specifically", () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    expect(formatError(err)).toContain("timed out");
  });

  it("formats generic errors", () => {
    expect(formatError(new Error("boom"))).toBe("Request failed: boom");
  });

  it("handles non-Error throws", () => {
    expect(formatError("just a string")).toBe("Request failed: just a string");
  });
});

describe("apiHandler", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TRUSTADD_API_KEY;
  });

  it("returns parsed data on 200", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ score: 88, verdict: "TRUSTED" }),
    });
    const result = await apiHandler("/x");
    expect(result.content[0].text).toContain("88");
    expect(result.content[0].text).toContain("TRUSTED");
  });

  it("returns UNKNOWN verdict on 404 when notFoundReturnsUnknown=true", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 404, json: async () => null });
    const result = await apiHandler("/x", { notFoundReturnsUnknown: true });
    expect(result.content[0].text).toContain("UNKNOWN");
  });

  it("returns isError on 404 when notFoundReturnsUnknown=false (default)", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 404, json: async () => null });
    const result = await apiHandler("/x");
    expect((result as any).isError).toBe(true);
  });

  it("returns isError with registration hint on 429 (anonymous)", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 429, json: async () => null });
    const result = await apiHandler("/x");
    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toMatch(/rate limit|register/i);
  });

  it("returns isError on 5xx", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ status: 503, json: async () => null });
    const result = await apiHandler("/x");
    expect((result as any).isError).toBe(true);
  });
});
