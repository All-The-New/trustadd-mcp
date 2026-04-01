import { storage } from "./storage.js";
import type { InsertX402Probe } from "../shared/schema.js";
import {
  runWithConcurrency,
  sleep,
  createLogger,
} from "./lib/indexer-utils.js";

const log = createLogger("x402-prober");

const PROBE_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 2;                          // concurrent endpoint probes (keep low to avoid DB pool pressure)
const STALE_HOURS = 24;
const PROBE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INTER_PROBE_DELAY_MS = 200;                  // 200ms between probes

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

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    if (BLOCKED_HOSTS.some((pattern) => pattern.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

interface ProbeResult {
  probeStatus: "success" | "no_402" | "error" | "timeout" | "unreachable";
  httpStatus: number | null;
  paymentAddress: string | null;
  paymentNetwork: string | null;
  paymentToken: string | null;
  paymentAmount: string | null;
  responseHeaders: Record<string, string> | null;
}

function extractPaymentFromHeaders(headers: Record<string, string>): Partial<ProbeResult> {
  const result: Partial<ProbeResult> = {};

  const addressKeys = ["x-payment-address", "x-pay-address", "x-402-address"];
  for (const key of addressKeys) {
    if (headers[key]) {
      result.paymentAddress = headers[key];
      break;
    }
  }

  const networkKeys = ["x-payment-network", "x-pay-network", "x-402-network", "x-payment-chain"];
  for (const key of networkKeys) {
    if (headers[key]) {
      result.paymentNetwork = headers[key];
      break;
    }
  }

  const tokenKeys = ["x-payment-token", "x-pay-token", "x-402-token", "x-payment-currency"];
  for (const key of tokenKeys) {
    if (headers[key]) {
      result.paymentToken = headers[key];
      break;
    }
  }

  const amountKeys = ["x-payment-amount", "x-pay-amount", "x-402-amount", "x-payment-price"];
  for (const key of amountKeys) {
    if (headers[key]) {
      result.paymentAmount = headers[key];
      break;
    }
  }

  return result;
}

function extractPaymentFromBody(body: any): Partial<ProbeResult> {
  if (!body || typeof body !== "object") return {};
  const result: Partial<ProbeResult> = {};

  const addrFields = ["paymentAddress", "payment_address", "address", "payTo", "pay_to", "recipient"];
  for (const field of addrFields) {
    const val = body[field] || body.payment?.[field] || body.x402?.[field];
    if (val && typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)) {
      result.paymentAddress = val;
      break;
    }
  }

  const netFields = ["network", "chain", "chainId", "chain_id"];
  for (const field of netFields) {
    const val = body[field] || body.payment?.[field] || body.x402?.[field];
    if (val) {
      result.paymentNetwork = String(val);
      break;
    }
  }

  const tokenFields = ["token", "currency", "asset"];
  for (const field of tokenFields) {
    const val = body[field] || body.payment?.[field] || body.x402?.[field];
    if (val) {
      result.paymentToken = String(val);
      break;
    }
  }

  const amtFields = ["amount", "price", "cost"];
  for (const field of amtFields) {
    const val = body[field] || body.payment?.[field] || body.x402?.[field];
    if (val !== undefined && val !== null) {
      result.paymentAmount = String(val);
      break;
    }
  }

  if (!result.paymentAddress && body.accepts) {
    const accepts = Array.isArray(body.accepts) ? body.accepts : [body.accepts];
    for (const accept of accepts) {
      if (accept?.address && /^0x[a-fA-F0-9]{40}$/.test(accept.address)) {
        result.paymentAddress = accept.address;
        result.paymentNetwork = accept.network || accept.chain || null;
        result.paymentToken = accept.token || accept.currency || null;
        result.paymentAmount = accept.amount ? String(accept.amount) : null;
        break;
      }
    }
  }

  return result;
}

export async function probeEndpoint(url: string): Promise<ProbeResult> {
  if (!isSafeUrl(url)) {
    return { probeStatus: "error", httpStatus: null, paymentAddress: null, paymentNetwork: null, paymentToken: null, paymentAmount: null, responseHeaders: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "TrustAdd/1.0 (x402-prober; https://trustadd.com)",
        "Accept": "application/json, */*",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (response.status === 402) {
      let bodyData: any = null;
      try {
        const text = await response.text();
        bodyData = JSON.parse(text);
      } catch {}

      const headerPayment = extractPaymentFromHeaders(headers);
      const bodyPayment = bodyData ? extractPaymentFromBody(bodyData) : {};

      return {
        probeStatus: "success",
        httpStatus: 402,
        paymentAddress: headerPayment.paymentAddress || bodyPayment.paymentAddress || null,
        paymentNetwork: headerPayment.paymentNetwork || bodyPayment.paymentNetwork || null,
        paymentToken: headerPayment.paymentToken || bodyPayment.paymentToken || null,
        paymentAmount: headerPayment.paymentAmount || bodyPayment.paymentAmount || null,
        responseHeaders: headers,
      };
    }

    return {
      probeStatus: "no_402",
      httpStatus: response.status,
      paymentAddress: null,
      paymentNetwork: null,
      paymentToken: null,
      paymentAmount: null,
      responseHeaders: null,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return { probeStatus: "timeout", httpStatus: null, paymentAddress: null, paymentNetwork: null, paymentToken: null, paymentAmount: null, responseHeaders: null };
    }
    return { probeStatus: err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" ? "unreachable" : "error", httpStatus: null, paymentAddress: null, paymentNetwork: null, paymentToken: null, paymentAmount: null, responseHeaders: null };
  }
}

export async function probeAgent(agentId: string): Promise<number> {
  const agent = await storage.getAgent(agentId);
  if (!agent || !agent.endpoints || !Array.isArray(agent.endpoints)) return 0;

  const httpEndpoints = (agent.endpoints as any[]).filter(
    (ep) => ep.endpoint && typeof ep.endpoint === "string" && ep.endpoint.startsWith("http")
  );

  let probed = 0;
  for (const ep of httpEndpoints) {
    if (_abortController?.signal.aborted) break;

    const recent = await storage.getRecentProbeForEndpoint(agentId, ep.endpoint);
    if (recent && (Date.now() - new Date(recent.probedAt).getTime()) < STALE_HOURS * 60 * 60 * 1000) {
      continue;
    }

    const result = await probeEndpoint(ep.endpoint);

    const probe: InsertX402Probe = {
      agentId,
      endpointUrl: ep.endpoint,
      endpointName: ep.name || null,
      probeStatus: result.probeStatus,
      httpStatus: result.httpStatus,
      paymentAddress: result.paymentAddress,
      paymentNetwork: result.paymentNetwork,
      paymentToken: result.paymentToken,
      paymentAmount: result.paymentAmount,
      responseHeaders: result.responseHeaders,
      chainId: agent.chainId,
    };

    await storage.createProbeResult(probe);
    probed++;

    if (result.probeStatus === "success" && result.paymentAddress) {
      log.info(`Found payment address for ${agent.name || agentId}: ${result.paymentAddress} (${result.paymentNetwork || "unknown network"})`);
    }

    if (probed < httpEndpoints.length) {
      await sleep(INTER_PROBE_DELAY_MS);
    }
  }

  return probed;
}

export async function probeAllAgents(): Promise<{ total: number; probed: number; found402: number; paymentAddresses: number; errors: number }> {
  const staleAgentIds = await storage.getStaleProbeAgentIds(STALE_HOURS);
  log.info(`Found ${staleAgentIds.length} agents to probe`);

  let totalProbed = 0;
  let errors = 0;

  await runWithConcurrency(
    staleAgentIds,
    async (agentId) => {
      try {
        const count = await probeAgent(agentId);
        totalProbed += count;
      } catch (err) {
        errors++;
        log.error(`Error probing agent ${agentId}`, { error: (err as Error).message });
      }
    },
    MAX_CONCURRENT,
    { interItemDelayMs: INTER_PROBE_DELAY_MS, abortSignal: _abortController?.signal ?? undefined },
  );

  const stats = await storage.getProbeStats();

  log.info(
    `Probe complete: ${totalProbed} endpoints probed across ${staleAgentIds.length} agents, ${stats.found402} returned 402, ${stats.uniquePaymentAddresses} payment addresses${errors > 0 ? `, ${errors} errors` : ""}`,
  );

  return { total: staleAgentIds.length, probed: totalProbed, found402: stats.found402, paymentAddresses: stats.uniquePaymentAddresses, errors };
}

let probeTimeout: ReturnType<typeof setTimeout> | null = null;
let _abortController: AbortController | null = null;
let _running = false;

const PROBE_RETRY_INTERVAL_MS = 60 * 60 * 1000; // 1h retry after failure

export function stopProber() {
  if (probeTimeout) {
    clearTimeout(probeTimeout);
    probeTimeout = null;
  }
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _running = false;
  log.info("Prober stopped");
}

export function initProber() {
  const enabled = process.env.ENABLE_PROBER === "true";
  if (!enabled) {
    log.info("Prober disabled (set ENABLE_PROBER=true to enable)");
    return;
  }

  if (_running) {
    log.warn("Prober already running — skipping duplicate init");
    return;
  }

  _running = true;
  _abortController = new AbortController();

  log.info("Starting x402 endpoint prober...");

  const scheduleNext = (delayMs: number) => {
    if (!_running) return;
    probeTimeout = setTimeout(runProbe, delayMs);
  };

  const runProbe = async () => {
    if (!_running) return;
    try {
      await probeAllAgents();
      scheduleNext(PROBE_INTERVAL_MS);
    } catch (err) {
      log.error("Probe cycle failed", { error: (err as Error).message });
      log.info(`Retrying in ${PROBE_RETRY_INTERVAL_MS / 60000} min...`);
      scheduleNext(PROBE_RETRY_INTERVAL_MS);
    }
  };

  scheduleNext(420_000); // 7 min after startup (staggered from tx-indexer at 10min)

  log.info(`Prober scheduled (first run: 7min, interval: ${PROBE_INTERVAL_MS / 3600000}h, retry-on-fail: ${PROBE_RETRY_INTERVAL_MS / 60000}min)`);
}
