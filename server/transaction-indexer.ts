import { storage } from "./storage";
import type { InsertAgentTransaction } from "@shared/schema";
import {
  retryWithBackoff,
  runWithConcurrency,
  sleep,
  createLogger,
  isTransientError,
} from "./lib/indexer-utils";

const log = createLogger("tx-indexer");

const MAX_CONCURRENT = 3;                          // parallel address syncing
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;      // every 6 hours
const ALCHEMY_PAGE_SIZE = 1000;
const INTER_REQUEST_DELAY_MS = 300;                // 300ms between Alchemy calls
const MAX_PAGES_PER_DIRECTION = 50;
const MAX_CHAIN_CONSECUTIVE_ERRORS = 5;
const ETH_DUST_THRESHOLD = 0.001;

const TOKEN_ADDRESSES: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
  ],
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
  ],
  137: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
  ],
  42161: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
  ],
};

const CHAIN_RPC_URLS: Record<number, string> = {
  1: "https://eth-mainnet.g.alchemy.com/v2/{key}",
  8453: "https://base-mainnet.g.alchemy.com/v2/{key}",
  137: "https://polygon-mainnet.g.alchemy.com/v2/{key}",
  42161: "https://arb-mainnet.g.alchemy.com/v2/{key}",
};

function getAlchemyUrl(chainId: number): string | null {
  const template = CHAIN_RPC_URLS[chainId];
  if (!template) return null;
  const key = process.env.API_KEY_ALCHEMY;
  if (!key) return null;
  return template.replace("{key}", key);
}

function parseTokenAmount(rawValue: string | number, decimals: number): number {
  if (typeof rawValue === "number") return rawValue;
  try {
    const cleaned = rawValue.replace(/^0x/, "");
    const bigVal = BigInt("0x" + cleaned);
    return Number(bigVal) / Math.pow(10, decimals);
  } catch {
    return parseFloat(rawValue) || 0;
  }
}

interface AlchemyTransfer {
  hash: string;
  uniqueId: string;
  from: string;
  to: string;
  value: number | null;
  rawContract: { value: string; address: string; decimal: string };
  blockNum: string;
  metadata: { blockTimestamp: string };
  asset: string;
  category: string;
}

async function fetchTransfers(
  rpcUrl: string,
  address: string,
  direction: "to" | "from",
  contractAddresses: string[],
  categories: string[],
  fromBlock: string,
  pageKey?: string,
): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> {
  const params: any = {
    [direction === "to" ? "toAddress" : "fromAddress"]: address,
    fromBlock,
    toBlock: "latest",
    category: categories,
    maxCount: `0x${ALCHEMY_PAGE_SIZE.toString(16)}`,
    withMetadata: true,
    order: "asc",
  };
  if (contractAddresses.length > 0) params.contractAddresses = contractAddresses;
  if (pageKey) params.pageKey = pageKey;

  return retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [params],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Alchemy HTTP ${response.status}: ${text.slice(0, 200)}`);
        }

        const data = await response.json();
        if (data.error) {
          const errMsg = data.error.message || JSON.stringify(data.error);
          if (errMsg.includes("rate") || errMsg.includes("limit") || errMsg.includes("429")) {
            throw new Error(`Rate limited: ${errMsg}`);
          }
          throw new Error(`Alchemy RPC error: ${errMsg}`);
        }

        return {
          transfers: data.result?.transfers ?? [],
          pageKey: data.result?.pageKey,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
          throw new Error("Alchemy request timeout (30s)");
        }
        throw err;
      }
    },
    {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
      onRetry: (attempt, err, delay) => {
        log.warn(
          `Alchemy fetch retry ${attempt}/3 for ${address.slice(0, 10)}... (${direction}): ${err.message} — waiting ${Math.round(delay)}ms`,
        );
      },
    },
  );
}

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI"]);

function resolveToken(chainId: number, contractAddr: string | undefined): { symbol: string; decimals: number; isStablecoin: boolean } {
  if (!contractAddr) return { symbol: "ETH", decimals: 18, isStablecoin: false };
  const tokens = TOKEN_ADDRESSES[chainId] ?? [];
  const match = tokens.find(t => t.address.toLowerCase() === contractAddr.toLowerCase());
  if (match) return { ...match, isStablecoin: STABLECOIN_SYMBOLS.has(match.symbol) };
  return { symbol: "UNKNOWN", decimals: 18, isStablecoin: false };
}

let _abortController: AbortController | null = null;

export async function syncAddressTransfers(
  address: string,
  chainId: number,
  agentId: string,
): Promise<{ synced: number; incoming: number; outgoing: number }> {
  const tokens = TOKEN_ADDRESSES[chainId];
  if (!tokens) return { synced: 0, incoming: 0, outgoing: 0 };

  const rpcUrl = getAlchemyUrl(chainId);
  if (!rpcUrl) return { synced: 0, incoming: 0, outgoing: 0 };

  const syncState = await storage.getTransactionSyncState(address, chainId);
  const fromBlock = syncState ? `0x${(syncState.lastSyncedBlock + 1).toString(16)}` : "0x0";

  let incoming = 0;
  let outgoing = 0;
  let maxBlock = syncState?.lastSyncedBlock ?? 0;

  const erc20Addresses = tokens.map(t => t.address);

  for (const direction of ["to", "from"] as const) {
    let pageKey: string | undefined;
    let pages = 0;

    do {
      if (_abortController?.signal.aborted) {
        log.info("Sync aborted by shutdown signal");
        return { synced: incoming + outgoing, incoming, outgoing };
      }

      const result = await fetchTransfers(rpcUrl, address, direction, erc20Addresses, ["erc20", "external"], fromBlock, pageKey);

      const batch: InsertAgentTransaction[] = [];
      for (const transfer of result.transfers) {
        const blockNum = parseInt(transfer.blockNum, 16);
        if (blockNum > maxBlock) maxBlock = blockNum;

        const contractAddr = transfer.rawContract?.address;
        const token = resolveToken(chainId, contractAddr);

        const rawAmount = transfer.rawContract?.value || "0";
        const amount = transfer.value ?? parseTokenAmount(rawAmount, token.decimals);
        const category = direction === "to" ? "incoming" : "outgoing";
        const amountUsd = token.isStablecoin ? amount : null;

        if (token.symbol === "ETH" && amount < ETH_DUST_THRESHOLD) {
          continue;
        }

        const transferId = transfer.uniqueId || `${transfer.hash}-${direction}-${transfer.from}-${transfer.to}`;
        batch.push({
          agentId,
          chainId,
          txHash: transfer.hash,
          transferId,
          fromAddress: transfer.from.toLowerCase(),
          toAddress: transfer.to.toLowerCase(),
          tokenAddress: contractAddr ? contractAddr.toLowerCase() : "native",
          tokenSymbol: transfer.asset || token.symbol,
          amount: amount.toString(),
          amountUsd,
          blockNumber: blockNum,
          blockTimestamp: new Date(transfer.metadata?.blockTimestamp || Date.now()),
          category,
          metadata: null,
        });

        if (category === "incoming") incoming++;
        else outgoing++;
      }

      for (const tx of batch) {
        await storage.createTransaction(tx);
      }

      pageKey = result.pageKey;
      pages++;

      if (pages >= MAX_PAGES_PER_DIRECTION) {
        log.warn(`Hit page limit (${MAX_PAGES_PER_DIRECTION}) for ${address.slice(0, 10)}... on chain ${chainId} (${direction})`);
        break;
      }

      if (pageKey) {
        await sleep(INTER_REQUEST_DELAY_MS);
      }
    } while (pageKey);
  }

  // Always update sync state to record that this address was checked, even if no
  // new transactions were found. This ensures health check staleness flags reflect
  // actual run cadence rather than last-transaction time.
  await storage.upsertTransactionSyncState(
    address,
    chainId,
    Math.max(maxBlock, syncState?.lastSyncedBlock ?? 0)
  );

  return { synced: incoming + outgoing, incoming, outgoing };
}

export async function syncAllAgentTransactions(): Promise<{
  addressesSynced: number;
  totalTxns: number;
  totalIncoming: number;
  totalOutgoing: number;
  errors: number;
}> {
  const addresses = await storage.getKnownPaymentAddresses();
  log.info(`Found ${addresses.length} payment addresses to sync`);

  if (addresses.length === 0) {
    return { addressesSynced: 0, totalTxns: 0, totalIncoming: 0, totalOutgoing: 0, errors: 0 };
  }

  let totalTxns = 0;
  let totalIncoming = 0;
  let totalOutgoing = 0;
  let addressesSynced = 0;
  let errors = 0;
  const chainErrors: Record<number, number> = {};

  await runWithConcurrency(
    addresses,
    async ({ address, chainId, agentId }) => {
      if (_abortController?.signal.aborted) return;

      if ((chainErrors[chainId] ?? 0) >= MAX_CHAIN_CONSECUTIVE_ERRORS) {
        log.warn(`Skipping ${address.slice(0, 10)}... — chain ${chainId} circuit breaker open (${chainErrors[chainId]} consecutive errors)`);
        return;
      }

      try {
        const result = await syncAddressTransfers(address, chainId, agentId);
        if (result.synced > 0) {
          log.info(
            `Synced ${result.synced} txns for ${address.slice(0, 10)}... on chain ${chainId} (${result.incoming} in, ${result.outgoing} out)`,
          );
        }
        totalTxns += result.synced;
        totalIncoming += result.incoming;
        totalOutgoing += result.outgoing;
        addressesSynced++;
        chainErrors[chainId] = 0;
      } catch (err) {
        errors++;
        chainErrors[chainId] = (chainErrors[chainId] ?? 0) + 1;
        const level = isTransientError(err) ? "warn" : "error";
        log[level](`Sync failed for ${address.slice(0, 10)}... on chain ${chainId}`, err);
      }
    },
    MAX_CONCURRENT,
    { interItemDelayMs: 100, abortSignal: _abortController?.signal ?? undefined },
  );

  log.info(
    `Sync complete: ${addressesSynced}/${addresses.length} addresses, ${totalTxns} transactions (${totalIncoming} in, ${totalOutgoing} out)${errors > 0 ? `, ${errors} errors` : ""}`,
  );

  return { addressesSynced, totalTxns, totalIncoming, totalOutgoing, errors };
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let _running = false;

const RETRY_INTERVAL_MS = 30 * 60 * 1000; // 30 min retry after failure

export function stopTransactionIndexer() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _running = false;
  log.info("Transaction indexer stopped");
}

export function initTransactionIndexer() {
  const enabled = process.env.ENABLE_TX_INDEXER === "true";
  if (!enabled) {
    log.info("Transaction indexer disabled (set ENABLE_TX_INDEXER=true to enable)");
    return;
  }

  const hasKey = !!process.env.API_KEY_ALCHEMY;
  if (!hasKey) {
    log.warn("Transaction indexer requires API_KEY_ALCHEMY — skipping");
    return;
  }

  if (_running) {
    log.warn("Transaction indexer already running — skipping duplicate init");
    return;
  }

  _running = true;
  _abortController = new AbortController();

  log.info("Transaction indexer starting (multi-token: USDC, USDT, DAI, WETH, ETH)...");

  const scheduleNext = (delayMs: number) => {
    if (!_running) return;
    syncTimeout = setTimeout(runSync, delayMs);
  };

  const runSync = async () => {
    if (!_running) return;
    try {
      const result = await syncAllAgentTransactions();
      if (result.errors > 0 && result.addressesSynced === 0) {
        log.error(`All syncs failed (${result.errors} errors) — possible API issue`);
        log.info(`Retrying in ${RETRY_INTERVAL_MS / 60000} min...`);
        scheduleNext(RETRY_INTERVAL_MS);
      } else {
        scheduleNext(SYNC_INTERVAL_MS);
      }
    } catch (err) {
      log.error("Sync cycle failed", err);
      log.info(`Retrying in ${RETRY_INTERVAL_MS / 60000} min...`);
      scheduleNext(RETRY_INTERVAL_MS);
    }
  };

  scheduleNext(600_000); // 10 min after startup (staggered: chains start at 0s, prober at 7min, tx at 10min)

  log.info(`Transaction indexer scheduled (first run: 10min, interval: ${SYNC_INTERVAL_MS / 3600000}h, retry-on-fail: ${RETRY_INTERVAL_MS / 60000}min)`);
}
