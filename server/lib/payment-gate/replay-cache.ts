interface Entry { key: string; expiresAt: number; }

export interface ReplayCacheOptions {
  ttlMs: number;
  maxSize: number;
}

/**
 * Small LRU with per-entry TTL. Insertion order preserved via Map iteration.
 * Single-process only — acceptable for Vercel serverless because replay is
 * also prevented by the underlying tx being a real on-chain transfer: the
 * window of risk is one warm-container lifetime (minutes).
 */
export class ReplayCache {
  private map = new Map<string, Entry>();
  private ttlMs: number;
  private maxSize: number;

  constructor(opts: ReplayCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxSize = opts.maxSize;
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  add(key: string): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { key, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxSize) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
}
