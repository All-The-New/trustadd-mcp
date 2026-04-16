/**
 * MPP endpoint prober and WWW-Authenticate: Payment header parser.
 *
 * MPP challenge format (IETF draft-ryan-httpauth-payment-00):
 *   WWW-Authenticate: Payment id="<id>", realm="<domain>", method="<method>",
 *     intent="<intent>", request="<base64url-encoded JSON>"
 *
 * Multiple Payment headers can coexist on one response; the client picks one.
 */

import type { InsertMppProbe } from "../shared/schema.js";
import { sleep, createLogger } from "./lib/indexer-utils.js";
import { TEMPO_CHAIN_ID } from "../shared/chains.js";

export interface ParsedPaymentChallenge {
  id: string;
  realm: string;
  method: string;      // tempo | stripe | lightning | ...
  intent: string;      // charge | stream | session
  request: Record<string, unknown> | null;
  raw: string;
}

/**
 * Parse a single WWW-Authenticate: Payment header value.
 * Returns null if the header is not a valid Payment challenge.
 */
export function parsePaymentAuthHeader(header: string): ParsedPaymentChallenge | null {
  if (!header) return null;

  // Strip optional leading "Payment " scheme token
  const trimmed = header.trim();
  const match = /^Payment\s+(.*)$/i.exec(trimmed);
  if (!match) return null;

  const params = parseAuthParams(match[1]);
  if (!params.id || !params.method) return null;

  let decodedRequest: Record<string, unknown> | null = null;
  if (params.request) {
    try {
      const json = base64UrlDecode(params.request);
      decodedRequest = JSON.parse(json);
    } catch {
      // Preserve raw challenge even if request payload is unreadable
      decodedRequest = null;
    }
  }

  return {
    id: params.id,
    realm: params.realm ?? "",
    method: params.method,
    intent: params.intent ?? "charge",
    request: decodedRequest,
    raw: header,
  };
}

/**
 * Parse multiple WWW-Authenticate header values (multi-method endpoints).
 * Non-Payment and malformed entries are filtered out.
 */
export function parseAllPaymentAuthHeaders(headers: string[]): ParsedPaymentChallenge[] {
  const out: ParsedPaymentChallenge[] = [];
  for (const h of headers) {
    const parsed = parsePaymentAuthHeader(h);
    if (parsed) out.push(parsed);
  }
  return out;
}

// --- internals ---

function parseAuthParams(input: string): Record<string, string> {
  // Parses comma-separated `key="value"` pairs, respecting quoted strings.
  const result: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    result[m[1]] = m[2].replace(/\\(.)/g, "$1");
  }
  return result;
}

function base64UrlDecode(input: string): string {
  // base64url -> base64
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

// --- Probing ---

const log = createLogger("mpp-prober");

const PROBE_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 2;
const STALE_HOURS = 24;
const INTER_PROBE_DELAY_MS = 200;

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^169\.254\.\d+\.\d+$/,
  /^\[::1?\]$/,
  /^metadata\.google/i,
  /^metadata\.aws/i,
];

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (BLOCKED_HOSTS.some((p) => p.test(parsed.hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

export interface MppProbeResult {
  probeStatus: "success" | "no_mpp" | "error" | "timeout" | "unreachable";
  httpStatus: number | null;
  hasMpp: boolean;
  paymentMethods: ParsedPaymentChallenge[] | null;
  tempoAddress: string | null;
  challengeData: Record<string, unknown> | null;
  responseHeaders: Record<string, string> | null;
}

/**
 * Extract all WWW-Authenticate header values from a Headers object.
 * fetch() combines duplicates into a comma-separated string, so we split carefully.
 */
function getWwwAuthenticateValues(headers: Headers): string[] {
  const raw = headers.get("www-authenticate");
  if (!raw) return [];
  // Split on commas that sit between two Payment/Bearer/... scheme names, not inside quotes.
  // Simple heuristic: split on ", Scheme " boundaries.
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') depth = depth === 0 ? 1 : 0;
    if (ch === "," && depth === 0 && /\s+[A-Z]\w*\s/.test(raw.slice(i, i + 30))) {
      parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * Pick a Tempo recipient address from a parsed payment method, if available.
 * The address may live in the decoded `request` payload under various keys.
 */
function extractTempoAddress(challenges: ParsedPaymentChallenge[]): string | null {
  for (const c of challenges) {
    if (c.method !== "tempo") continue;
    const req = c.request ?? {};
    const keys = ["recipient", "payTo", "pay_to", "address", "to"];
    for (const k of keys) {
      const v = (req as Record<string, unknown>)[k];
      if (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v)) return v;
    }
  }
  return null;
}

export async function probeMppEndpoint(url: string): Promise<MppProbeResult> {
  const empty: MppProbeResult = {
    probeStatus: "error",
    httpStatus: null,
    hasMpp: false,
    paymentMethods: null,
    tempoAddress: null,
    challengeData: null,
    responseHeaders: null,
  };

  if (!isSafeUrl(url)) return empty;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "TrustAdd/1.0 (mpp-prober; https://trustadd.com)",
        "Accept": "application/json, */*",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    if (response.status !== 402) {
      return { ...empty, probeStatus: "no_mpp", httpStatus: response.status, responseHeaders: headers };
    }

    const authValues = getWwwAuthenticateValues(response.headers);
    const challenges = parseAllPaymentAuthHeaders(authValues);

    if (challenges.length === 0) {
      return { ...empty, probeStatus: "no_mpp", httpStatus: 402, responseHeaders: headers };
    }

    const tempoAddress = extractTempoAddress(challenges);

    return {
      probeStatus: "success",
      httpStatus: 402,
      hasMpp: true,
      paymentMethods: challenges,
      tempoAddress,
      challengeData: { challenges: challenges.map((c) => ({ method: c.method, intent: c.intent, request: c.request })) },
      responseHeaders: headers,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return { ...empty, probeStatus: "timeout" };
    return { ...empty, probeStatus: err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" ? "unreachable" : "error" };
  }
}

/**
 * Probe all HTTP endpoints for the given agent. Writes probe results to the
 * mpp_probes table and upserts any discovered Tempo recipients into
 * transaction_sync_state so the tempo indexer picks them up.
 */
export async function probeAgentForMpp(agentId: string): Promise<number> {
  const { storage } = await import("./storage.js");
  const agent = await storage.getAgent(agentId);
  if (!agent || !agent.endpoints || !Array.isArray(agent.endpoints)) return 0;

  const httpEndpoints = (agent.endpoints as any[]).filter(
    (ep) => ep.endpoint && typeof ep.endpoint === "string" && ep.endpoint.startsWith("http"),
  );

  let probed = 0;
  for (const ep of httpEndpoints) {
    const recent = await storage.getRecentMppProbeForEndpoint(agentId, ep.endpoint);
    if (recent && (Date.now() - new Date(recent.probedAt).getTime()) < STALE_HOURS * 60 * 60 * 1000) {
      continue;
    }

    const result = await probeMppEndpoint(ep.endpoint);

    const insert: InsertMppProbe = {
      agentId,
      endpointUrl: ep.endpoint,
      probeStatus: result.probeStatus,
      httpStatus: result.httpStatus,
      hasMpp: result.hasMpp,
      paymentMethods: result.paymentMethods as unknown as any,
      tempoAddress: result.tempoAddress,
      challengeData: result.challengeData as unknown as any,
      responseHeaders: result.responseHeaders as unknown as any,
    };
    await storage.createMppProbe(insert);
    probed++;

    if (result.hasMpp && result.tempoAddress) {
      await storage.upsertTransactionSyncState({
        paymentAddress: result.tempoAddress,
        chainId: TEMPO_CHAIN_ID,
        lastSyncedBlock: 0,
      });
      log.info(`MPP endpoint for ${agent.name || agentId}: tempo=${result.tempoAddress}`);
    }

    if (probed < httpEndpoints.length) await sleep(INTER_PROBE_DELAY_MS);
  }

  return probed;
}

export async function probeAllAgentsForMpp(options?: { deadlineMs?: number }): Promise<{
  total: number; probed: number; foundMpp: number; tempoAddresses: number; errors: number; skippedDueToTimeout: number;
}> {
  const { storage } = await import("./storage.js");
  const { runWithConcurrency } = await import("./lib/indexer-utils.js");

  const ids = await storage.getStaleMppProbeAgentIds(STALE_HOURS);
  log.info(`Found ${ids.length} agents to MPP-probe`);

  let totalProbed = 0;
  let errors = 0;
  let skippedDueToTimeout = 0;
  const deadline = options?.deadlineMs;

  await runWithConcurrency(
    ids,
    async (agentId) => {
      if (deadline && Date.now() > deadline) { skippedDueToTimeout++; return; }
      try {
        totalProbed += await probeAgentForMpp(agentId);
      } catch (err) {
        errors++;
        log.error(`MPP probe failed for ${agentId}`, { error: (err as Error).message });
      }
    },
    MAX_CONCURRENT,
    { interItemDelayMs: INTER_PROBE_DELAY_MS },
  );

  const stats = await storage.getMppProbeStats();
  log.info(`MPP probe cycle complete: probed=${totalProbed} foundMpp=${stats.foundMpp} tempoAddresses=${stats.tempoAddresses}`);

  return {
    total: ids.length,
    probed: totalProbed,
    foundMpp: stats.foundMpp,
    tempoAddresses: stats.tempoAddresses,
    errors,
    skippedDueToTimeout,
  };
}
