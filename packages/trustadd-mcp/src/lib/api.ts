import { textResult, errorResult, type ToolResult } from "./responses.js";

const DEFAULT_API_BASE = "https://trustadd.com";
const TIMEOUT_MS = 15_000;

function apiBase(): string {
  return process.env.TRUSTADD_API_URL || DEFAULT_API_BASE;
}

export async function apiGet(path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${apiBase()}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

/** Map common HTTP statuses to user-friendly errors. Returns null if status is a 2xx success. */
function mapStatusToError(status: number): string | null {
  if (status === 400) return "Invalid address format";
  if (status === 404) return null; // caller decides: usually textResult({ verdict: 'UNKNOWN' })
  if (status === 429) return "Rate limit exceeded — retry after a short delay";
  if (status === 503) return "Trust Data Product is temporarily unavailable";
  if (status >= 500) return `TrustAdd API error (HTTP ${status})`;
  return null;
}

/** Shared handler for x402-gated endpoints. 402 → payment-required structure; otherwise status mapping. */
export async function paidHandler(path: string, price: string): Promise<ToolResult> {
  const { status, data } = await apiGet(path);

  if (status === 402) {
    return textResult({
      paymentRequired: true,
      price,
      message:
        `This endpoint requires x402 payment (${price} USDC on Base). ` +
        "The TrustAdd MCP server does not handle x402 payments directly — " +
        "use the REST API with an x402-compatible HTTP client, or visit trustadd.com.",
      details: data,
    });
  }
  if (status === 404) return textResult({ verdict: "UNKNOWN", message: "No agent found for this address" });

  const mapped = mapStatusToError(status);
  if (mapped) return errorResult(mapped);
  return textResult(data);
}

/** Free endpoint handler: map errors, return data on success. */
export async function freeHandler(path: string): Promise<ToolResult> {
  const { status, data } = await apiGet(path);
  const mapped = mapStatusToError(status);
  if (mapped) return errorResult(mapped);
  if (status === 404) return errorResult("Not found");
  return textResult(data);
}
