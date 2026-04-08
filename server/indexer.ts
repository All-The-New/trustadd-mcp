import { ethers } from "ethers";
import { storage } from "./storage.js";
import { log } from "./lib/log.js";
import { createLogger } from "./lib/logger.js";
import { type ChainConfig, getEnabledChains, getRpcUrls } from "../shared/chains.js";
import { recalculateScore } from "./trust-score.js";
import { classifyAgent } from "./quality-classifier.js";

const POLL_INTERVAL_MS = 60_000;         // 1 min between cycles
const POLL_JITTER_MS = 10_000;           // ±10s jitter
const BACKFILL_BLOCK_RANGE = 50_000;     // eth_getLogs chunk size
const LIVE_BLOCK_RANGE = 2_000;
const MAX_BLOCKS_PER_CYCLE = 500_000;    // max blocks per cycle
const METADATA_FETCH_TIMEOUT_MS = 8_000;
const REQUEST_DELAY_MS = 150;            // 150ms between RPC calls
const RERESOLVE_BATCH_LIMIT = 300;       // agents per re-resolve batch
const RERESOLVE_DELAY_MS = 500;          // 500ms between metadata fetches
const RPC_TIMEOUT_MS = 15_000;
const RPC_TIMEOUT_BACKFILL_MS = 30_000;
const CHAIN_START_STAGGER_MS = 30_000;   // 30s between chain starts
const MAX_CONSECUTIVE_ERRORS = 2;
const ERROR_BACKOFF_BASE_MS = 60_000;
const PROVIDER_RECREATE_THRESHOLD = 3;
const TIMEOUT_REDUCE_THRESHOLD = 3;      // reduce range after 3 consecutive timeouts
const MIN_BACKFILL_BLOCK_RANGE = 200;    // floor for auto-reduction
const RERESOLVE_CHAIN_STAGGER_MS = 60_000; // 1 min between chain re-resolves

const IDENTITY_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event AgentURISet(uint256 indexed agentId, string agentURI)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const REPUTATION_ABI = [
  "event FeedbackPosted(uint256 indexed agentId, address indexed reviewer, bytes32 indexed feedbackHash, string feedbackURI)",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AgentRegistrationMetadata {
  name?: string;
  description?: string;
  capabilities?: string[];
  endpoints?: Array<{ name: string; endpoint: string }> | Record<string, string>;
  pricing?: Record<string, unknown>;
  tags?: string[];
  oasf_skills?: string[];
  oasf_domains?: string[];
  x402Support?: boolean;
  x402support?: boolean;
  supportedTrust?: string[];
  supported_trust?: string[];
  image?: string;
  active?: boolean;
  services?: Array<{ name: string; endpoint: string }>;
}

const URI_BLOCKLIST_DOMAINS = [
  "eips.ethereum.org",
  "example.com",
  "localhost",
];

async function resolveAgentURI(uri: string): Promise<AgentRegistrationMetadata | null> {
  if (!uri) return null;

  try {
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      fetchUrl = `https://ipfs.io/ipfs/${cid}`;
    } else if (uri.startsWith("data:application/json;base64,")) {
      const base64Data = uri.replace("data:application/json;base64,", "");
      const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
      return JSON.parse(decoded) as AgentRegistrationMetadata;
    } else if (uri.startsWith("data:application/json,")) {
      const jsonStr = decodeURIComponent(uri.replace("data:application/json,", ""));
      return JSON.parse(jsonStr) as AgentRegistrationMetadata;
    } else if (!uri.startsWith("http")) {
      return null;
    }

    try {
      const hostname = new URL(fetchUrl).hostname;
      if (URI_BLOCKLIST_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d))) {
        return null;
      }
    } catch {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return null;
    }

    const data = await response.json();
    return data as AgentRegistrationMetadata;
  } catch (err) {
    log(`Failed to resolve URI ${uri.slice(0, 60)}...: ${(err as Error).message}`, "indexer");
    return null;
  }
}

interface MetricsAccumulator {
  blocksIndexed: number;
  cyclesCompleted: number;
  cyclesFailed: number;
  rpcRequests: number;
  rpcErrors: number;
  cycleDurations: number[];
  agentsDiscovered: number;
  periodStart: Date;
}

function createMetricsAccumulator(): MetricsAccumulator {
  return {
    blocksIndexed: 0,
    cyclesCompleted: 0,
    cyclesFailed: 0,
    rpcRequests: 0,
    rpcErrors: 0,
    cycleDurations: [],
    agentsDiscovered: 0,
    periodStart: new Date(),
  };
}

const METRICS_FLUSH_INTERVAL_MS = 15 * 60 * 1000;

export class ERC8004Indexer {
  private chainConfig: ChainConfig;
  private provider: ethers.JsonRpcProvider;
  private fallbackProviders: ethers.JsonRpcProvider[];
  private identityContract: ethers.Contract;
  private fallbackIdentityContracts: ethers.Contract[];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private logPrefix: string;
  private consecutiveErrors = 0;
  private consecutiveTimeouts = 0;
  private metrics: MetricsAccumulator = createMetricsAccumulator();
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private cycleAgentsFound = 0;
  private isBackfillTimeout = false;
  private isStarting = false;
  private reResolveFailures = new Map<string, number>();
  private consecutiveSpamBlocks = 0;
  private spamRanges: Array<{ from: number; to: number }> = [];
  private effectiveBackfillRange: number;
  private authFailedProviders = new Set<number>(); // indices of providers that returned 403

  constructor(chainConfig: ChainConfig) {
    this.chainConfig = chainConfig;
    this.logPrefix = `indexer:${chainConfig.shortName}`;
    this.effectiveBackfillRange = chainConfig.backfillBlockRange ?? BACKFILL_BLOCK_RANGE;
    this.createProviders(RPC_TIMEOUT_MS);
  }

  private createProviders(timeoutMs: number) {
    const urls = getRpcUrls(this.chainConfig);
    if (!urls.primary) {
      throw new Error(`No RPC URL available for ${this.chainConfig.name}`);
    }

    const network = ethers.Network.from(this.chainConfig.chainId);
    const fetchReq = new ethers.FetchRequest(urls.primary);
    fetchReq.timeout = timeoutMs;
    this.provider = new ethers.JsonRpcProvider(fetchReq, network, { staticNetwork: true, batchMaxCount: 1 });

    this.fallbackProviders = urls.fallbacks.map((url) => {
      const req = new ethers.FetchRequest(url);
      req.timeout = timeoutMs;
      return new ethers.JsonRpcProvider(req, network, { staticNetwork: true, batchMaxCount: 1 });
    });

    this.identityContract = new ethers.Contract(this.chainConfig.identityRegistry, IDENTITY_ABI, this.provider);
    this.fallbackIdentityContracts = this.fallbackProviders.map(
      (p) => new ethers.Contract(this.chainConfig.identityRegistry, IDENTITY_ABI, p),
    );
  }

  private recycleProviders(reason: "timeout_threshold" | "connection_retry" = "timeout_threshold") {
    if (reason === "timeout_threshold") {
      log(`Recycling RPC providers after ${this.consecutiveTimeouts} consecutive timeouts`, this.logPrefix);
    } else {
      log(`Recycling RPC providers for fresh connection attempt`, this.logPrefix);
    }
    try {
      this.provider.destroy();
      for (const p of this.fallbackProviders) p.destroy();
    } catch {}
    this.createProviders(RPC_TIMEOUT_MS);
    this.consecutiveTimeouts = 0;
    this.authFailedProviders.clear(); // retry auth on fresh providers
    this.emitEvent("recovery", `Recycled RPC providers to clear stale connections`, { reason }).catch(() => {});
  }

  get chainId(): number {
    return this.chainConfig.chainId;
  }

  get chainName(): string {
    return this.chainConfig.name;
  }

  private async rpcWithFallback<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    // Try primary unless it has a cached auth failure
    if (!this.authFailedProviders.has(-1)) {
      try {
        return await fn(this.provider);
      } catch (err) {
        const msg = (err as Error).message || "";
        if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("not enabled")) {
          this.authFailedProviders.add(-1);
          log(`Primary RPC returned 403 — skipping for future calls, falling back to public RPCs`, this.logPrefix);
        }
        // Fall through to fallbacks
        let lastErr = err;
        for (let i = 0; i < this.fallbackProviders.length; i++) {
          if (this.authFailedProviders.has(i)) continue;
          const nextLabel = i === 0 ? "fallback" : `fallback-${i + 1}`;
          log(`primary RPC failed (${msg.slice(0, 80)}), trying ${nextLabel}`, this.logPrefix);
          try {
            return await fn(this.fallbackProviders[i]);
          } catch (fbErr) {
            const fbMsg = (fbErr as Error).message || "";
            if (fbMsg.includes("403") || fbMsg.includes("Forbidden") || fbMsg.includes("not enabled")) {
              this.authFailedProviders.add(i);
            }
            lastErr = fbErr;
          }
        }
        log(`All ${this.fallbackProviders.length + 1} RPC providers failed: ${(lastErr as Error).message?.slice(0, 100)}`, this.logPrefix);
        throw lastErr;
      }
    }

    // Primary is auth-failed, try fallbacks directly
    let lastErr: unknown;
    for (let i = 0; i < this.fallbackProviders.length; i++) {
      if (this.authFailedProviders.has(i)) continue;
      try {
        return await fn(this.fallbackProviders[i]);
      } catch (fbErr) {
        const fbMsg = (fbErr as Error).message || "";
        if (fbMsg.includes("403") || fbMsg.includes("Forbidden") || fbMsg.includes("not enabled")) {
          this.authFailedProviders.add(i);
        }
        lastErr = fbErr;
      }
    }
    throw lastErr ?? new Error(`All RPC providers auth-failed for ${this.chainConfig.name}`);
  }

  private async contractCallWithFallback<T>(
    fn: (contract: ethers.Contract) => Promise<T>,
  ): Promise<T> {
    try {
      return await fn(this.identityContract);
    } catch (err) {
      let lastErr = err;
      for (let i = 0; i < this.fallbackIdentityContracts.length; i++) {
        const label = i === 0 ? "fallback" : `fallback-${i + 1}`;
        log(`Primary contract call failed, trying ${label}: ${(lastErr as Error).message?.slice(0, 100)}`, this.logPrefix);
        try {
          return await fn(this.fallbackIdentityContracts[i]);
        } catch (fbErr) {
          lastErr = fbErr;
        }
      }
      throw lastErr;
    }
  }

  async start(options?: { singleCycle?: boolean; retryAttempt?: number }) {
    const singleCycle = options?.singleCycle ?? false;
    const retryAttempt = options?.retryAttempt ?? 0;

    if (this.isStarting) {
      log(`${this.chainConfig.name} start() called while already starting — skipping duplicate`, this.logPrefix);
      return;
    }
    this.isStarting = true;
    const MAX_START_RETRIES = singleCycle ? 1 : 5;
    log(`Starting ERC-8004 indexer for ${this.chainConfig.name} (chainId: ${this.chainConfig.chainId})${singleCycle ? " [single-cycle]" : ""}${retryAttempt > 0 ? ` (retry ${retryAttempt}/${MAX_START_RETRIES})` : ""}...`, this.logPrefix);

    try {
      const blockNumber = await this.rpcWithFallback((p) => p.getBlockNumber());
      log(`Connected to ${this.chainConfig.name} at block ${blockNumber}`, this.logPrefix);
    } catch (err) {
      const errorMsg = (err as Error).message;
      log(`Failed to connect to ${this.chainConfig.name}: ${errorMsg}`, this.logPrefix);
      this.isStarting = false;
      try {
        await storage.updateIndexerState(this.chainConfig.chainId, {
          isRunning: false,
          lastError: `RPC connection failed: ${errorMsg}`,
        });
      } catch (dbErr) {
        log(`Warning: DB state update failed during RPC connect failure (${(dbErr as Error).message?.slice(0, 80)})`, this.logPrefix);
      }

      // In single-cycle mode, throw immediately — let Trigger.dev handle retries
      if (singleCycle) {
        throw new Error(`RPC connection failed for ${this.chainConfig.name}: ${errorMsg}`);
      }

      if (retryAttempt < MAX_START_RETRIES) {
        const retryDelay = Math.min(ERROR_BACKOFF_BASE_MS * Math.pow(2, retryAttempt), 600_000);
        log(`Will retry ${this.chainConfig.name} in ${Math.round(retryDelay / 1000)}s`, this.logPrefix);
        setTimeout(() => {
          this.recycleProviders("connection_retry");
          this.start({ retryAttempt: retryAttempt + 1 }).catch((e) => {
            log(`Retry start error for ${this.chainConfig.name}: ${(e as Error).message}`, this.logPrefix);
          });
        }, retryDelay);
      } else {
        const resetDelay = 15 * 60 * 1000;
        log(`${this.chainConfig.name} exhausted ${MAX_START_RETRIES} start retries — will try again in 15min`, this.logPrefix);
        setTimeout(() => {
          this.recycleProviders("connection_retry");
          this.start({ retryAttempt: 0 }).catch((e) => {
            log(`Restart error for ${this.chainConfig.name}: ${(e as Error).message}`, this.logPrefix);
          });
        }, resetDelay);
      }
      return;
    }

    this.isStarting = false;
    try {
      await storage.updateIndexerState(this.chainConfig.chainId, { isRunning: true, lastError: null });
    } catch (dbErr) {
      log(`Warning: DB state update failed after RPC connect (${(dbErr as Error).message?.slice(0, 80)}) — continuing`, this.logPrefix);
    }

    if (singleCycle) {
      // Single-cycle mode: await one cycle, no polling, no metrics timer
      await this.runIndexCycle();
      return;
    }

    if (!this.metricsTimer) {
      this.startMetricsFlush();
    }

    this.runIndexCycle().catch((err) => {
      log(`Initial index cycle error: ${(err as Error).message}`, this.logPrefix);
    });

    this.scheduleNextPoll();
    log(`Indexer polling every ${POLL_INTERVAL_MS / 1000}s for ${this.chainConfig.name}`, this.logPrefix);
  }

  async stop() {
    this.isStarting = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    await this.flushMetrics();
    await storage.updateIndexerState(this.chainConfig.chainId, { isRunning: false });
    log(`Indexer stopped for ${this.chainConfig.name}`, this.logPrefix);
  }

  getMetricsSnapshot() {
    return {
      blocksIndexed: this.metrics.blocksIndexed,
      agentsDiscovered: this.metrics.agentsDiscovered,
      cyclesCompleted: this.metrics.cyclesCompleted,
      cyclesFailed: this.metrics.cyclesFailed,
      rpcRequests: this.metrics.rpcRequests,
      rpcErrors: this.metrics.rpcErrors,
    };
  }

  private startMetricsFlush() {
    this.metricsTimer = setInterval(() => {
      this.flushMetrics().catch(err => {
        log(`Metrics flush error: ${(err as Error).message}`, this.logPrefix);
      });
    }, METRICS_FLUSH_INTERVAL_MS);
  }

  private async flushMetrics() {
    const m = this.metrics;
    if (m.cyclesCompleted === 0 && m.cyclesFailed === 0) return;

    const avgCycleMs = m.cycleDurations.length > 0
      ? Math.round(m.cycleDurations.reduce((a, b) => a + b, 0) / m.cycleDurations.length)
      : 0;

    try {
      await storage.recordMetricsPeriod({
        chainId: this.chainConfig.chainId,
        periodStart: m.periodStart,
        periodMinutes: 60,
        blocksIndexed: m.blocksIndexed,
        cyclesCompleted: m.cyclesCompleted,
        cyclesFailed: m.cyclesFailed,
        rpcRequests: m.rpcRequests,
        rpcErrors: m.rpcErrors,
        avgCycleMs,
        agentsDiscovered: m.agentsDiscovered,
      });
      log(`Metrics flushed: ${m.cyclesCompleted} ok, ${m.cyclesFailed} fail, ${m.blocksIndexed} blocks, ${m.agentsDiscovered} agents`, this.logPrefix);
    } catch (err) {
      log(`Failed to flush metrics: ${(err as Error).message}`, this.logPrefix);
    }

    this.metrics = createMetricsAccumulator();
  }

  private async emitEvent(eventType: string, message: string, metadata?: Record<string, unknown>) {
    try {
      await storage.logIndexerEvent({
        chainId: this.chainConfig.chainId,
        eventType,
        source: this.logPrefix,
        message,
        metadata: metadata || null,
      });
    } catch (err) {
      createLogger(this.logPrefix).error(`Failed to emit indexer event (${eventType})`, { error: (err as Error).message });
    }
  }

  private scheduleNextPoll(overrideDelay?: number) {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    let delay: number;
    if (overrideDelay !== undefined) {
      delay = overrideDelay;
    } else {
      const jitter = Math.floor(Math.random() * POLL_JITTER_MS * 2) - POLL_JITTER_MS;
      delay = POLL_INTERVAL_MS + jitter;
      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        delay = Math.min(
          ERROR_BACKOFF_BASE_MS * Math.pow(2, this.consecutiveErrors - MAX_CONSECUTIVE_ERRORS),
          600_000,
        );
        log(`Backing off ${Math.round(delay / 1000)}s after ${this.consecutiveErrors} consecutive errors`, this.logPrefix);
        this.emitEvent("backoff", `Backing off ${Math.round(delay / 1000)}s after ${this.consecutiveErrors} consecutive errors`, { backoffMs: delay, consecutiveErrors: this.consecutiveErrors }).catch(() => {});
      }
    }

    this.pollTimer = setTimeout(async () => {
      if (this.isProcessing) {
        log(`Poll delayed: index cycle still in progress — retrying in 30s`, this.logPrefix);
        this.scheduleNextPoll(30_000);
        return;
      }
      try {
        await this.runIndexCycle();
      } catch (err) {
        log(`Poll cycle error: ${(err as Error).message}`, this.logPrefix);
      }
      this.scheduleNextPoll();
    }, delay);
  }

  async reResolveMetadata() {
    const RERESOLVE_MAX_FAILURES = 3;
    log(`Starting metadata re-resolution for ${this.chainConfig.name}...`, this.logPrefix);
    const allAgents = await storage.getAgentsForReResolve(this.chainConfig.chainId);
    const needsUpdate = allAgents.filter(
      (a) =>
        a.metadataUri &&
        (a.tags === null || a.oasfSkills === null) &&
        (this.reResolveFailures.get(a.id) ?? 0) < RERESOLVE_MAX_FAILURES
    );
    const skippedCount = allAgents.filter(
      (a) => a.metadataUri && (this.reResolveFailures.get(a.id) ?? 0) >= RERESOLVE_MAX_FAILURES
    ).length;
    const batch = needsUpdate.slice(0, RERESOLVE_BATCH_LIMIT);
    log(
      `Found ${needsUpdate.length} agents needing re-resolution, processing batch of ${batch.length}` +
      (skippedCount > 0 ? ` (${skippedCount} skipped — consistent failures this session)` : ""),
      this.logPrefix
    );

    let updated = 0;
    for (let i = 0; i < batch.length; i++) {
      const agent = batch[i];
      try {
        const metadata = await resolveAgentURI(agent.metadataUri!);
        if (!metadata) {
          const failures = (this.reResolveFailures.get(agent.id) ?? 0) + 1;
          this.reResolveFailures.set(agent.id, failures);
          await sleep(RERESOLVE_DELAY_MS);
          continue;
        }

        // Reset failure count on successful resolution
        this.reResolveFailures.delete(agent.id);

        const updates: Record<string, unknown> = {};
        if (metadata.tags && metadata.tags.length > 0) updates.tags = metadata.tags;
        if (metadata.oasf_skills && metadata.oasf_skills.length > 0) updates.oasfSkills = metadata.oasf_skills;
        if (metadata.oasf_domains && metadata.oasf_domains.length > 0) updates.oasfDomains = metadata.oasf_domains;
        if (metadata.x402Support !== undefined || metadata.x402support !== undefined) {
          updates.x402Support = metadata.x402Support ?? metadata.x402support;
        }
        if (metadata.supportedTrust || metadata.supported_trust) {
          updates.supportedTrust = metadata.supportedTrust || metadata.supported_trust;
        }
        if (metadata.image) updates.imageUrl = metadata.image;
        if (metadata.active !== undefined) updates.activeStatus = metadata.active;
        const rawEndpoints = metadata.endpoints || metadata.services;
        if (rawEndpoints) updates.endpoints = rawEndpoints;

        const tier = agent.qualityTier ?? "unclassified";
        const enrichIntervals: Record<string, number> = {
          high: 6 * 60 * 60 * 1000,
          medium: 24 * 60 * 60 * 1000,
          low: 7 * 24 * 60 * 60 * 1000,
          spam: 30 * 24 * 60 * 60 * 1000,
          archived: 30 * 24 * 60 * 60 * 1000,
        };
        const intervalMs = enrichIntervals[tier] ?? 24 * 60 * 60 * 1000;
        updates.nextEnrichmentAt = new Date(Date.now() + intervalMs);

        if (Object.keys(updates).length > 0) {
          await storage.updateAgent(agent.id, updates as any);
          updated++;
        }

        await sleep(RERESOLVE_DELAY_MS);
      } catch (err) {
        const failures = (this.reResolveFailures.get(agent.id) ?? 0) + 1;
        this.reResolveFailures.set(agent.id, failures);
        if (failures >= RERESOLVE_MAX_FAILURES) {
          log(`Agent ${agent.id} skipped for re-resolution after ${failures} consecutive failures`, this.logPrefix);
        }
      }

      if (i > 0 && i % 50 === 0) {
        storage.updateIndexerState(this.chainConfig.chainId, { updatedAt: new Date() }).catch(() => {});
      }
    }
    log(`Re-resolution batch complete: ${updated}/${batch.length} updated (${needsUpdate.length - batch.length} remaining)`, this.logPrefix);
  }

  private async loadSpamRanges(afterBlock: number): Promise<void> {
    try {
      const rows = await storage.getSpamRanges(this.chainConfig.chainId, afterBlock);
      // Merge overlapping/adjacent ranges into consolidated ranges
      if (rows.length === 0) { this.spamRanges = []; return; }
      const sorted = rows.sort((a, b) => a.from - b.from);
      const merged: Array<{ from: number; to: number }> = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].from <= last.to + 1) {
          last.to = Math.max(last.to, sorted[i].to);
        } else {
          merged.push(sorted[i]);
        }
      }
      this.spamRanges = merged;
      if (merged.length > 0) {
        log(`Loaded ${merged.length} merged spam ranges (${rows.length} raw) after block ${afterBlock.toLocaleString()}`, this.logPrefix);
      }
    } catch (err) {
      log(`Failed to load spam ranges: ${(err as Error).message}`, this.logPrefix);
      this.spamRanges = [];
    }
  }

  private isChunkFullySpam(from: number, to: number): boolean {
    for (const range of this.spamRanges) {
      if (from >= range.from && to <= range.to) return true;
      if (range.from > to) break; // Ranges are sorted, no need to check further
    }
    return false;
  }

  private classifyError(msg: string): string {
    if (msg.includes("TIMEOUT") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
    if (msg.includes("Too Many Requests") || msg.includes("rate limit") || msg.includes("402") || msg.includes("Payment Required")) return "rate_limit";
    if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("not enabled for this app")) return "auth_error";
    if (msg.includes("socket disconnected") || msg.includes("ECONNRESET") || msg.includes("ECONNREFUSED") || msg.includes("Authentication timed out")) return "connection_error";
    return "error";
  }

  private async runIndexCycle() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    const cycleStart = Date.now();
    this.cycleAgentsFound = 0;

    try {
      const state = await storage.getIndexerState(this.chainConfig.chainId);
      const startBlock = state.lastProcessedBlock > 0 ? state.lastProcessedBlock + 1 : this.chainConfig.deploymentBlock;
      this.metrics.rpcRequests++;
      const currentBlock = await this.rpcWithFallback((p) => p.getBlockNumber());

      if (startBlock > currentBlock) {
        this.isProcessing = false;
        return;
      }

      const totalBlocks = currentBlock - startBlock;
      const isBackfill = totalBlocks > LIVE_BLOCK_RANGE;
      const chunkSize = isBackfill ? this.effectiveBackfillRange : LIVE_BLOCK_RANGE;
      const effectiveEnd = isBackfill ? Math.min(startBlock + MAX_BLOCKS_PER_CYCLE - 1, currentBlock) : currentBlock;

      if (isBackfill) {
        this.createProviders(RPC_TIMEOUT_BACKFILL_MS);
        this.isBackfillTimeout = true;
        log(`Backfilling ${totalBlocks.toLocaleString()} blocks (${startBlock} -> ${currentBlock}), chunk=${this.effectiveBackfillRange.toLocaleString()}, timeout=${RPC_TIMEOUT_BACKFILL_MS / 1000}s`, this.logPrefix);
      }

      // Pre-load known spam ranges to skip without RPC calls
      await this.loadSpamRanges(startBlock);

      let from = startBlock;
      let spamRangeStart: number | null = null;
      while (from <= effectiveEnd) {
        const to = Math.min(from + chunkSize - 1, effectiveEnd);

        // Skip chunks entirely contained in known spam ranges (no RPC calls)
        if (this.isChunkFullySpam(from, to)) {
          if (spamRangeStart === null) {
            spamRangeStart = from;
            log(`Skipping cached spam range starting at block ${from.toLocaleString()}`, this.logPrefix);
          }
          from = to + 1;
          await storage.updateIndexerState(this.chainConfig.chainId, {
            lastProcessedBlock: to,
            lastError: null,
          });
          continue;
        }

        this.consecutiveSpamBlocks = 0;
        await this.processBlockRangeWithBisection(from, to);

        // If spam detection triggered, log one summary event and advance past the chunk
        if (this.consecutiveSpamBlocks >= 5) {
          if (spamRangeStart === null) spamRangeStart = from;
          log(`Spam factory range detected at blocks ${from.toLocaleString()}-${to.toLocaleString()} — skipping chunk`, this.logPrefix);
        } else {
          if (spamRangeStart !== null) {
            // Emit one summary event for the entire spam range that just ended
            this.emitEvent("spam_skip", `Skipped spam factory blocks ${spamRangeStart.toLocaleString()}-${(from - 1).toLocaleString()} (${(from - spamRangeStart).toLocaleString()} blocks)`, {
              fromBlock: spamRangeStart, toBlock: from - 1, blocksSkipped: from - spamRangeStart,
            }).catch(() => {});
            spamRangeStart = null;
          }
        }

        await storage.updateIndexerState(this.chainConfig.chainId, {
          lastProcessedBlock: to,
          lastError: null,
        });

        if (isBackfill && to < effectiveEnd) {
          const progress = (((to - startBlock) / (effectiveEnd - startBlock)) * 100).toFixed(1);
          log(`Backfill progress: ${progress}% (block ${to.toLocaleString()})`, this.logPrefix);
          await sleep(REQUEST_DELAY_MS);
        }

        from = to + 1;
      }

      // Emit final spam range event if cycle ended in a spam zone
      if (spamRangeStart !== null) {
        this.emitEvent("spam_skip", `Skipped spam factory blocks ${spamRangeStart.toLocaleString()}-${effectiveEnd.toLocaleString()} (${(effectiveEnd - spamRangeStart + 1).toLocaleString()} blocks)`, {
          fromBlock: spamRangeStart, toBlock: effectiveEnd, blocksSkipped: effectiveEnd - spamRangeStart + 1,
        }).catch(() => {});
      }

      if (isBackfill) {
        this.createProviders(RPC_TIMEOUT_MS);
        this.isBackfillTimeout = false;
      }

      const blocksProcessed = effectiveEnd - startBlock + 1;
      const cycleDuration = Date.now() - cycleStart;

      if (isBackfill && effectiveEnd < currentBlock) {
        log(`Cycle capped at ${MAX_BLOCKS_PER_CYCLE.toLocaleString()} blocks. ${(currentBlock - effectiveEnd).toLocaleString()} remaining.`, this.logPrefix);
      } else if (totalBlocks > 0) {
        log(`Indexed up to block ${effectiveEnd.toLocaleString()}`, this.logPrefix);
      }

      const prevErrors = this.consecutiveErrors;
      this.consecutiveErrors = 0;
      this.consecutiveTimeouts = 0;

      this.metrics.blocksIndexed += blocksProcessed;
      this.metrics.cyclesCompleted++;
      this.metrics.cycleDurations.push(cycleDuration);
      this.metrics.agentsDiscovered += this.cycleAgentsFound;

      if (blocksProcessed > 0 || this.cycleAgentsFound > 0) {
        this.emitEvent("cycle_complete", `Indexed ${blocksProcessed.toLocaleString()} blocks in ${(cycleDuration / 1000).toFixed(1)}s, ${this.cycleAgentsFound} agents found`, {
          blocksProcessed, cycleDurationMs: cycleDuration, agentsFound: this.cycleAgentsFound, fromBlock: startBlock, toBlock: effectiveEnd,
        }).catch(() => {});
      }

      if (prevErrors > 0) {
        this.emitEvent("recovery", `Recovered after ${prevErrors} consecutive errors`, { previousErrors: prevErrors }).catch(() => {});
        log(`Recovered after ${prevErrors} consecutive errors`, this.logPrefix);
      }
    } catch (err) {
      this.consecutiveErrors++;
      const errorMsg = (err as Error).message;
      const errorType = this.classifyError(errorMsg);
      const cycleDuration = Date.now() - cycleStart;
      const isTimeout = errorMsg.includes("timeout") || errorMsg.includes("TIMEOUT") || errorMsg.includes("timed out") || errorMsg.includes("ETIMEDOUT") || errorMsg.includes("socket disconnected") || errorMsg.includes("ECONNRESET");

      if (isTimeout) {
        this.consecutiveTimeouts++;
        if (this.consecutiveTimeouts >= PROVIDER_RECREATE_THRESHOLD) {
          this.recycleProviders();
        }
        // Auto-reduce backfill block range after repeated timeouts
        if (this.consecutiveTimeouts >= TIMEOUT_REDUCE_THRESHOLD && this.effectiveBackfillRange > MIN_BACKFILL_BLOCK_RANGE) {
          const prev = this.effectiveBackfillRange;
          this.effectiveBackfillRange = Math.max(Math.floor(this.effectiveBackfillRange / 2), MIN_BACKFILL_BLOCK_RANGE);
          log(`Auto-reduced backfill range ${prev.toLocaleString()} → ${this.effectiveBackfillRange.toLocaleString()} after ${this.consecutiveTimeouts} consecutive timeouts`, this.logPrefix);
          this.emitEvent("range_reduced", `Backfill range auto-reduced from ${prev} to ${this.effectiveBackfillRange}`, {
            previousRange: prev, newRange: this.effectiveBackfillRange, consecutiveTimeouts: this.consecutiveTimeouts,
          }).catch(() => {});
        }
      } else {
        this.consecutiveTimeouts = 0;
      }

      this.metrics.cyclesFailed++;
      this.metrics.rpcErrors++;

      log(`Index cycle error (${this.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS} before backoff): ${errorMsg.slice(0, 200)}`, this.logPrefix);
      await storage.updateIndexerState(this.chainConfig.chainId, { lastError: errorMsg.slice(0, 500) });

      this.emitEvent(errorType, errorMsg.slice(0, 500), {
        consecutiveErrors: this.consecutiveErrors, cycleDurationMs: cycleDuration,
        errorCategory: errorType, chainId: this.chainConfig.chainId,
      }).catch(() => {});
    } finally {
      this.isProcessing = false;
      if (this.isBackfillTimeout) {
        this.createProviders(RPC_TIMEOUT_MS);
        this.isBackfillTimeout = false;
      }
    }
  }

  private async processBlockRangeWithBisection(fromBlock: number, toBlock: number, depth = 0): Promise<void> {
    // If we've seen many consecutive spam blocks, skip the rest of this range
    if (this.consecutiveSpamBlocks >= 5) {
      return; // Caller will handle bulk skip
    }

    try {
      await this.processBlockRange(fromBlock, toBlock);
      // Successful processing resets spam counter
      this.consecutiveSpamBlocks = 0;
    } catch (err) {
      const msg = (err as Error).message || "";
      const isLimit =
        msg.includes("limit exceeded") ||
        msg.includes("block range") ||
        msg.includes("query returned more than") ||
        msg.includes("too many results") ||
        (err as any).error?.code === -32005 ||
        (err as any).code === -32005;

      if (isLimit && fromBlock < toBlock && depth < 20) {
        // If we've already seen 3+ consecutive spam blocks and depth is high,
        // assume the entire sub-range is spam and skip the RPC calls
        if (this.consecutiveSpamBlocks >= 3 && depth >= 8) {
          this.consecutiveSpamBlocks += (toBlock - fromBlock + 1);
          return;
        }
        const mid = Math.floor((fromBlock + toBlock) / 2);
        log(`-32005 limit: bisecting [${fromBlock.toLocaleString()}, ${toBlock.toLocaleString()}] → mid ${mid.toLocaleString()} (depth=${depth})`, this.logPrefix);
        await this.processBlockRangeWithBisection(fromBlock, mid, depth + 1);
        if (this.consecutiveSpamBlocks >= 5) return; // Abort further bisection
        await sleep(REQUEST_DELAY_MS);
        await this.processBlockRangeWithBisection(mid + 1, toBlock, depth + 1);
        return;
      }

      if (isLimit && fromBlock === toBlock) {
        // Single block still overflows every provider's result limit.
        // This is a bulk-spam factory block with thousands of events.
        this.consecutiveSpamBlocks++;
        if (this.consecutiveSpamBlocks <= 5) {
          log(`Spam factory block ${fromBlock.toLocaleString()} skipped (${this.consecutiveSpamBlocks} consecutive)`, this.logPrefix);
        }
        return;
      }

      throw err;
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const identityIface = new ethers.Interface(IDENTITY_ABI);
    const reputationIface = new ethers.Interface(REPUTATION_ABI);

    const transferTopic = identityIface.getEvent("Transfer")!.topicHash;
    const uriTopic = identityIface.getEvent("AgentURISet")!.topicHash;

    // Batch Transfer + URI into one RPC call using topic OR
    this.metrics.rpcRequests++;
    const identityLogs = await this.getLogsWithRetry(
      this.chainConfig.identityRegistry, [transferTopic, uriTopic], fromBlock, toBlock,
    );
    await sleep(REQUEST_DELAY_MS);

    this.metrics.rpcRequests++;
    const feedbackLogs = await this.getLogsWithRetry(
      this.chainConfig.reputationRegistry, reputationIface.getEvent("FeedbackPosted")!.topicHash, fromBlock, toBlock,
    );

    // Split identity logs by event type
    const transferLogs = identityLogs.filter((l) => l.topics[0] === transferTopic);
    const uriLogs = identityLogs.filter((l) => l.topics[0] === uriTopic);

    const mintLogs = transferLogs.filter(
      (l) => l.topics[1] === ethers.zeroPadValue(ethers.ZeroAddress, 32),
    );

    for (const mintLog of mintLogs) {
      await this.processAgentRegistration(mintLog, identityIface);
      await sleep(REQUEST_DELAY_MS);
    }

    for (const uriLog of uriLogs) {
      await this.processURIUpdate(uriLog, identityIface);
    }

    for (const fbLog of feedbackLogs) {
      await this.processFeedback(fbLog, reputationIface);
    }
  }

  private getProviderForAttempt(attempt: number): ethers.JsonRpcProvider {
    const all = [this.provider, ...this.fallbackProviders];
    return all[attempt % all.length];
  }

  private isRetryableError(msg: string, code: string): { retryable: boolean; category: string; delay: (attempt: number) => number } {
    if (msg.includes("Too Many Requests") || msg.includes("rate limit") || msg.includes("Payment Required") || msg.includes("402")) {
      return { retryable: true, category: "rate-limit", delay: (a) => Math.min(REQUEST_DELAY_MS * Math.pow(3, a), 30_000) };
    }
    if (code === "TIMEOUT" || msg.includes("TIMEOUT") || msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
      return { retryable: true, category: "timeout", delay: (a) => Math.min(5000 * a, 30_000) };
    }
    if (msg.includes("socket disconnected") || msg.includes("ECONNRESET") || msg.includes("ECONNREFUSED") || msg.includes("Authentication timed out")) {
      return { retryable: true, category: "connection", delay: (a) => Math.min(5000 * a, 30_000) };
    }
    return { retryable: false, category: "unknown", delay: (a) => REQUEST_DELAY_MS * a };
  }

  private async getLogsWithRetry(
    address: string,
    topic0: string | string[],
    fromBlock: number,
    toBlock: number,
    retries = 3,
  ): Promise<ethers.Log[]> {
    const topics: (string | string[])[] = Array.isArray(topic0) ? [topic0] : [topic0];
    const filter = { address, topics, fromBlock, toBlock };

    for (let attempt = 1; attempt <= retries; attempt++) {
      const provider = this.getProviderForAttempt(attempt);
      try {
        return await provider.getLogs(filter);
      } catch (err) {
        const msg = (err as Error).message || "";
        const code = (err as any).code || "";

        const isRangeTooLarge =
          msg.includes("block range") ||
          msg.includes("10 block range") ||
          msg.includes("limit exceeded") ||
          msg.includes("query returned more than") ||
          msg.includes("too many results") ||
          (err as any).error?.code === -32005 ||
          (err as any).code === -32005;
        if (isRangeTooLarge) {
          if (fromBlock === toBlock) {
            return await provider.getLogs({ ...filter, fromBlock, toBlock });
          }
          const mid = Math.floor((fromBlock + toBlock) / 2);
          const first = await this.getLogsWithRetry(address, topic0, fromBlock, mid, retries);
          await sleep(REQUEST_DELAY_MS);
          const second = await this.getLogsWithRetry(address, topic0, mid + 1, toBlock, retries);
          return [...first, ...second];
        }

        const errorInfo = this.isRetryableError(msg, code);
        if (errorInfo.retryable && attempt < retries) {
          const delay = errorInfo.delay(attempt);
          log(`${errorInfo.category}: waiting ${Math.round(delay / 1000)}s (attempt ${attempt}/${retries})`, this.logPrefix);
          await sleep(delay);
          continue;
        }

        if (attempt === retries) throw err;
        await sleep(REQUEST_DELAY_MS * attempt);
      }
    }

    return [];
  }

  private async processAgentRegistration(mintLog: ethers.Log, iface: ethers.Interface) {
    try {
      const parsed = iface.parseLog({ topics: mintLog.topics as string[], data: mintLog.data });
      if (!parsed) return;

      const tokenId = parsed.args[2];
      const toAddress = ethers.getAddress(ethers.dataSlice(mintLog.topics[2], 12));
      const erc8004Id = tokenId.toString();

      const existing = await storage.getAgentByErc8004Id(erc8004Id, this.chainConfig.chainId);
      if (existing) {
        const existingEvent = await storage.getEventByAgentAndTxHash(existing.id, mintLog.transactionHash, "AgentRegistered");
        if (!existingEvent) {
          await storage.createAgentEvent({
            agentId: existing.id,
            txHash: mintLog.transactionHash,
            blockNumber: mintLog.blockNumber,
            eventType: "AgentRegistered",
            chainId: this.chainConfig.chainId,
            rawData: {
              tokenId: erc8004Id,
              owner: toAddress,
              contractAddress: this.chainConfig.identityRegistry,
              note: "Dedup: agent existed, event was missing",
            },
          });
        }
        return;
      }

      let name: string | null = null;
      let description: string | null = null;
      let capabilities: string[] | null = null;
      let metadataUri: string | null = null;
      let tags: string[] | null = null;
      let oasfSkills: string[] | null = null;
      let oasfDomains: string[] | null = null;
      let endpoints: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
      let x402Support: boolean | null = null;
      let supportedTrust: string[] | null = null;
      let imageUrl: string | null = null;
      let activeStatus: boolean | null = null;

      try {
        const uri = await this.contractCallWithFallback((c) => c.tokenURI(tokenId));
        metadataUri = uri;
        const metadata = await resolveAgentURI(uri);
        if (metadata) {
          name = metadata.name || null;
          description = metadata.description || null;
          capabilities = metadata.capabilities || null;
          tags = metadata.tags || null;
          oasfSkills = metadata.oasf_skills || null;
          oasfDomains = metadata.oasf_domains || null;
          x402Support = metadata.x402Support ?? metadata.x402support ?? null;
          supportedTrust = metadata.supportedTrust || metadata.supported_trust || null;
          imageUrl = metadata.image || null;
          activeStatus = metadata.active ?? null;
          const rawEndpoints = metadata.endpoints || metadata.services || null;
          if (rawEndpoints) {
            endpoints = rawEndpoints;
          }
        }
      } catch (err) {
        log(`Could not fetch metadata for agent ${erc8004Id}: ${(err as Error).message?.slice(0, 100)}`, this.logPrefix);
      }

      const existingEvent = await storage.getEventByTxHash(mintLog.transactionHash, "AgentRegistered", this.chainConfig.chainId);
      if (existingEvent) return;

      const agent = await storage.createAgent({
        erc8004Id,
        primaryContractAddress: this.chainConfig.identityRegistry,
        controllerAddress: toAddress,
        chainId: this.chainConfig.chainId,
        name,
        description,
        claimed: false,
        firstSeenBlock: mintLog.blockNumber,
        lastUpdatedBlock: mintLog.blockNumber,
        capabilities,
        metadataUri,
        tags,
        oasfSkills,
        oasfDomains,
        endpoints,
        x402Support,
        supportedTrust,
        imageUrl,
        activeStatus,
      });

      await storage.createAgentEvent({
        agentId: agent.id,
        txHash: mintLog.transactionHash,
        blockNumber: mintLog.blockNumber,
        eventType: "AgentRegistered",
        chainId: this.chainConfig.chainId,
        rawData: {
          tokenId: erc8004Id,
          owner: toAddress,
          contractAddress: this.chainConfig.identityRegistry,
          metadataUri,
        },
      });

      const classification = classifyAgent({
        name: agent.name,
        description: agent.description,
        metadataUri: agent.metadataUri,
        trustScore: agent.trustScore,
        createdAt: agent.createdAt,
      });
      await storage.updateAgent(agent.id, {
        qualityTier: classification.qualityTier,
        spamFlags: classification.spamFlags,
        lifecycleStatus: classification.lifecycleStatus,
        metadataFingerprint: classification.metadataFingerprint,
        nextEnrichmentAt: classification.nextEnrichmentAt,
        lastQualityEvaluatedAt: new Date(),
      } as any);

      this.cycleAgentsFound++;
      log(`Discovered agent #${erc8004Id} (${name || "unnamed"}) at block ${mintLog.blockNumber}`, this.logPrefix);

      recalculateScore(agent.id).catch(() => {});
    } catch (err) {
      log(`Error processing registration: ${(err as Error).message?.slice(0, 150)}`, this.logPrefix);
    }
  }

  private async processURIUpdate(uriLog: ethers.Log, iface: ethers.Interface) {
    try {
      const parsed = iface.parseLog({ topics: uriLog.topics as string[], data: uriLog.data });
      if (!parsed) return;

      const agentId = parsed.args[0].toString();
      const newURI = parsed.args[1];

      const existingEvent = await storage.getEventByTxHash(uriLog.transactionHash, "MetadataUpdated", this.chainConfig.chainId);
      if (existingEvent) return;

      const agent = await storage.getAgentByErc8004Id(agentId, this.chainConfig.chainId);
      if (!agent) return;

      let name: string | null = null;
      let description: string | null = null;
      let capabilities: string[] | null = null;

      const metadata = await resolveAgentURI(newURI);
      const updates: Record<string, unknown> = {
        metadataUri: newURI,
        lastUpdatedBlock: uriLog.blockNumber,
      };
      if (metadata) {
        name = metadata.name || null;
        description = metadata.description || null;
        capabilities = metadata.capabilities || null;
        if (name) updates.name = name;
        if (description) updates.description = description;
        if (capabilities) updates.capabilities = capabilities;
        if (metadata.tags) updates.tags = metadata.tags;
        if (metadata.oasf_skills) updates.oasfSkills = metadata.oasf_skills;
        if (metadata.oasf_domains) updates.oasfDomains = metadata.oasf_domains;
        if (metadata.x402Support !== undefined || metadata.x402support !== undefined) {
          updates.x402Support = metadata.x402Support ?? metadata.x402support;
        }
        if (metadata.supportedTrust || metadata.supported_trust) {
          updates.supportedTrust = metadata.supportedTrust || metadata.supported_trust;
        }
        if (metadata.image) updates.imageUrl = metadata.image;
        if (metadata.active !== undefined) updates.activeStatus = metadata.active;
        const rawEndpoints = metadata.endpoints || metadata.services;
        if (rawEndpoints) updates.endpoints = rawEndpoints;
      }

      await storage.updateAgent(agent.id, updates as any);

      await storage.createAgentEvent({
        agentId: agent.id,
        txHash: uriLog.transactionHash,
        blockNumber: uriLog.blockNumber,
        eventType: "MetadataUpdated",
        chainId: this.chainConfig.chainId,
        rawData: {
          agentId,
          newURI,
          resolvedName: name,
          resolvedDescription: description,
        },
      });

      log(`Agent #${agentId} URI updated at block ${uriLog.blockNumber}`, this.logPrefix);

      recalculateScore(agent.id).catch(() => {});
    } catch (err) {
      log(`Error processing URI update: ${(err as Error).message?.slice(0, 150)}`, this.logPrefix);
    }
  }

  private async processFeedback(fbLog: ethers.Log, iface: ethers.Interface) {
    try {
      const parsed = iface.parseLog({ topics: fbLog.topics as string[], data: fbLog.data });
      if (!parsed) return;

      const agentId = parsed.args[0].toString();
      const reviewer = ethers.getAddress(ethers.dataSlice(fbLog.topics[2], 12));
      const feedbackHash = fbLog.topics[3];
      const feedbackURI = parsed.args[3];

      const existingEvent = await storage.getEventByTxHash(fbLog.transactionHash, "FeedbackPosted", this.chainConfig.chainId);
      if (existingEvent) return;

      const agent = await storage.getAgentByErc8004Id(agentId, this.chainConfig.chainId);
      if (!agent) return;

      await storage.updateAgent(agent.id, {
        lastUpdatedBlock: fbLog.blockNumber,
      });

      await storage.createAgentEvent({
        agentId: agent.id,
        txHash: fbLog.transactionHash,
        blockNumber: fbLog.blockNumber,
        eventType: "FeedbackPosted",
        chainId: this.chainConfig.chainId,
        rawData: {
          agentId,
          reviewer,
          feedbackHash,
          feedbackURI,
        },
      });

      log(`Feedback posted for agent #${agentId} at block ${fbLog.blockNumber}`, this.logPrefix);

      recalculateScore(agent.id).catch(() => {});
    } catch (err) {
      log(`Error processing feedback: ${(err as Error).message?.slice(0, 150)}`, this.logPrefix);
    }
  }
}

const indexerInstances: Map<number, ERC8004Indexer> = new Map();

export function startIndexer(): ERC8004Indexer[] {
  const enabledChains = getEnabledChains();

  if (enabledChains.length === 0) {
    throw new Error("No chains have available RPC keys. Set API_KEY_ALCHEMY or API_KEY_INFURA.");
  }

  storage.pruneOldEvents(7).catch(err => log(`Prune events error: ${(err as Error).message}`, "startup"));
  storage.pruneOldMetrics(30).catch(err => log(`Prune metrics error: ${(err as Error).message}`, "startup"));

  const started: ERC8004Indexer[] = [];

  for (let i = 0; i < enabledChains.length; i++) {
    const chain = enabledChains[i];
    if (indexerInstances.has(chain.chainId)) {
      started.push(indexerInstances.get(chain.chainId)!);
      continue;
    }

    try {
      const indexer = new ERC8004Indexer(chain);
      indexerInstances.set(chain.chainId, indexer);

      const staggerDelay = i * CHAIN_START_STAGGER_MS;
      if (staggerDelay > 0) {
        log(`Staggering ${chain.name} start by ${staggerDelay / 1000}s to spread RPC load`, "startup");
      }
      setTimeout(() => {
        indexer.start().catch((err) => {
          log(`Start error for ${chain.name}: ${(err as Error).message}`, `indexer:${chain.shortName}`);
        });
        if (process.env.ENABLE_RERESOLVE === "true") {
          const reResolveDelay = i * RERESOLVE_CHAIN_STAGGER_MS + 5 * 60_000;
          log(`Scheduling metadata re-resolution for ${chain.name} in ${Math.round(reResolveDelay / 1000)}s`, `indexer:${chain.shortName}`);
          setTimeout(() => {
            indexer.reResolveMetadata().catch((err) => {
              log(`Metadata re-resolution error for ${chain.name}: ${(err as Error).message}`, `indexer:${chain.shortName}`);
            });
          }, reResolveDelay);
        }
      }, staggerDelay);

      started.push(indexer);
      log(`Indexer queued for ${chain.name} (chainId: ${chain.chainId}, start in ${staggerDelay / 1000}s)`, "startup");
    } catch (err) {
      log(`Failed to start indexer for ${chain.name}: ${(err as Error).message}`, "startup");
    }
  }

  if (process.env.ENABLE_RERESOLVE !== "true") {
    log("Metadata re-resolution disabled (set ENABLE_RERESOLVE=true to enable)", "startup");
  }

  // Watchdog is now an out-of-process Trigger.dev task (trigger/watchdog.ts)

  log(`${started.length}/${enabledChains.length} chain indexers running`, "startup");
  return started;
}

export function getIndexer(chainId?: number): ERC8004Indexer | null {
  if (chainId !== undefined) {
    return indexerInstances.get(chainId) || null;
  }
  const first = indexerInstances.values().next();
  return first.done ? null : first.value;
}

export function getAllIndexers(): Map<number, ERC8004Indexer> {
  return indexerInstances;
}

/**
 * Start indexers for all enabled chains immediately (no stagger delay).
 * Designed for ephemeral Trigger.dev containers where a 30s stagger
 * wastes too much of the limited run window.
 * Returns the number of chains that connected successfully.
 */
export async function startIndexerImmediate(): Promise<{ started: number; failed: string[] }> {
  const enabledChains = getEnabledChains();
  if (enabledChains.length === 0) {
    throw new Error("No chains have available RPC keys. Set API_KEY_ALCHEMY or API_KEY_INFURA.");
  }

  storage.pruneOldEvents(7).catch(() => {});
  storage.pruneOldMetrics(30).catch(() => {});

  let started = 0;
  const failed: string[] = [];

  for (const chain of enabledChains) {
    try {
      const indexer = new ERC8004Indexer(chain);
      indexerInstances.set(chain.chainId, indexer);
      await indexer.start();
      started++;
      log(`Indexer started for ${chain.name}`, "startup");
    } catch (err) {
      failed.push(`${chain.name}: ${(err as Error).message?.slice(0, 80)}`);
      log(`Failed to start ${chain.name}: ${(err as Error).message}`, "startup");
    }
  }

  log(`${started}/${enabledChains.length} chains started (${failed.length} failed)`, "startup");
  return { started, failed };
}

export function stopIndexer() {
  for (const [chainId, indexer] of indexerInstances) {
    indexer.stop().catch((err) => {
      log(`Error stopping indexer for chain ${chainId}: ${(err as Error).message}`, "shutdown");
    });
  }
}

/**
 * Start a single chain's indexer, run exactly one index cycle, flush metrics, and stop.
 * Designed for per-chain Trigger.dev child tasks.
 */
export async function startSingleChainImmediate(chainId: number): Promise<{
  success: boolean;
  chainId: number;
  chainName: string;
  blocksIndexed: number;
  agentsDiscovered: number;
  error?: string;
}> {
  const enabledChains = getEnabledChains();
  const chain = enabledChains.find((c) => c.chainId === chainId);
  if (!chain) {
    return {
      success: false,
      chainId,
      chainName: `unknown-${chainId}`,
      blocksIndexed: 0,
      agentsDiscovered: 0,
      error: `Chain ${chainId} not found or disabled`,
    };
  }

  storage.pruneOldEvents(7).catch(() => {});
  storage.pruneOldMetrics(30).catch(() => {});

  const indexer = new ERC8004Indexer(chain);
  indexerInstances.set(chainId, indexer);

  try {
    await indexer.start({ singleCycle: true });
    const metrics = indexer.getMetricsSnapshot();
    await indexer.stop();
    indexerInstances.delete(chainId);

    return {
      success: true,
      chainId,
      chainName: chain.name,
      blocksIndexed: metrics.blocksIndexed,
      agentsDiscovered: metrics.agentsDiscovered,
    };
  } catch (err) {
    const errorMsg = (err as Error).message?.slice(0, 200) ?? String(err);
    try { await indexer.stop(); } catch {}
    indexerInstances.delete(chainId);

    return {
      success: false,
      chainId,
      chainName: chain.name,
      blocksIndexed: 0,
      agentsDiscovered: 0,
      error: errorMsg,
    };
  }
}
