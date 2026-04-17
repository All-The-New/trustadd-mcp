import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, formatError, paidHandler } from "../../src/lib/api.js";

describe("apiGet", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
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
    delete process.env.TRUSTADD_API_URL;
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

describe("paidHandler", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns payment-required structure on 402", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 402,
      json: async () => ({ accepts: [{ maxAmountRequired: "10000" }] }),
    });
    const result = await paidHandler("/api/v1/trust/0xabc", "$0.01");
    expect(result.content[0].text).toContain("paymentRequired");
    expect(result.content[0].text).toContain("$0.01");
  });

  it("returns UNKNOWN verdict on 404", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 404,
      json: async () => null,
    });
    const result = await paidHandler("/x", "$0.01");
    expect(result.content[0].text).toContain("UNKNOWN");
  });

  it("returns isError on 429", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 429,
      json: async () => null,
    });
    const result = await paidHandler("/x", "$0.01");
    expect((result as any).isError).toBe(true);
  });

  it("returns parsed data on 200", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      status: 200,
      json: async () => ({ score: 88, verdict: "TRUSTED" }),
    });
    const result = await paidHandler("/x", "$0.01");
    expect(result.content[0].text).toContain("88");
    expect(result.content[0].text).toContain("TRUSTED");
  });
});
