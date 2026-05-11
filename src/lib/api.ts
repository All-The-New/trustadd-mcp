// packages/trustadd-mcp/src/lib/api.ts
import { textResult, errorResult, type ToolResult } from "./responses.js";
import { readApiKey } from "./auth.js";

const DEFAULT_API_BASE = "https://trustadd.com";
const TIMEOUT_MS = 15_000;

function apiBase(): string {
  return process.env.TRUSTADD_API_URL || DEFAULT_API_BASE;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const key = readApiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function apiGet(path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${apiBase()}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: buildHeaders(),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export function formatError(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `TrustAdd API timed out after ${TIMEOUT_MS / 1000}s — try again`;
  }
  return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
}

function mapStatusToError(status: number, hasKey: boolean): string | null {
  if (status === 400) return "Invalid address format";
  if (status === 404) return null; // caller decides
  if (status === 429) {
    return hasKey
      ? "Rate limit exceeded for your API key — retry after the window resets (see X-RateLimit-Reset header)"
      : "Anonymous rate limit exceeded — register a free API key at https://trustadd.com/register for higher limits";
  }
  if (status === 503) return "TrustAdd API is temporarily unavailable";
  if (status >= 500) return `TrustAdd API error (HTTP ${status})`;
  return null;
}

export interface HandlerOptions {
  /** If true, a 404 returns a textResult({ verdict: 'UNKNOWN' }) instead of an error. Default: false. */
  notFoundReturnsUnknown?: boolean;
}

export async function apiHandler(path: string, opts: HandlerOptions = {}): Promise<ToolResult> {
  const { status, data } = await apiGet(path);
  if (status === 404 && opts.notFoundReturnsUnknown) {
    return textResult({ verdict: "UNKNOWN", message: "No agent found for this address" });
  }
  const hasKey = readApiKey() !== undefined;
  const mapped = mapStatusToError(status, hasKey);
  if (mapped) return errorResult(mapped);
  if (status === 404) return errorResult("Not found");
  return textResult(data);
}
