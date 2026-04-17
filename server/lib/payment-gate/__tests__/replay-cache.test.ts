import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ReplayCache } from "../replay-cache.js";

describe("ReplayCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("records a key and reports it as used", () => {
    const cache = new ReplayCache({ ttlMs: 1000, maxSize: 10 });
    expect(cache.has("k1")).toBe(false);
    cache.add("k1");
    expect(cache.has("k1")).toBe(true);
  });

  it("expires entries after TTL", () => {
    const cache = new ReplayCache({ ttlMs: 1000, maxSize: 10 });
    cache.add("k1");
    vi.advanceTimersByTime(1001);
    expect(cache.has("k1")).toBe(false);
  });

  it("evicts oldest entries when size exceeds max", () => {
    const cache = new ReplayCache({ ttlMs: 1_000_000, maxSize: 2 });
    cache.add("a");
    cache.add("b");
    cache.add("c");
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });
});
