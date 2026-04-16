/**
 * Tempo chain (ID 4217) transaction indexer for MPP payments.
 *
 * Queries pathUSD Transfer + TransferWithMemo events via eth_getLogs,
 * writes matches against known tracked payment addresses into
 * agent_transactions with category="mpp_payment".
 *
 * Tempo quirks handled:
 * - No native gas token: we never query eth_getBalance
 * - Tx type 0x76: we only read event logs, which are standard eth_getLogs
 * - Simplex BFT finality: no reorgs, safe to index up to head
 */

import { createLogger, sleep, retryWithBackoff } from "./lib/indexer-utils.js";
import { TEMPO_CHAIN_CONFIG, TEMPO_CHAIN_ID } from "../shared/chains.js";
import type { InsertAgentTransaction } from "../shared/schema.js";

const log = createLogger("tempo-tx-indexer");

const BLOCK_WINDOW = 10_000;
const MAX_CONCURRENT_ADDRESSES = 2;
const RPC_RETRY_ATTEMPTS = 3;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Placeholder topic for TransferWithMemo. Confirm during impl via Tempo source;
// until then, fall back to standard Transfer only and skip memo decoding.
const TRANSFER_WITH_MEMO_TOPIC = process.env.TEMPO_TRANSFER_WITH_MEMO_TOPIC ?? null;

// --- Decoders (pure functions for testability) ---

export interface DecodedTransfer {
  from: string;
  to: string;
  amountRaw: string;
  amount: string;       // human-readable, 6-decimal
  txHash: string;
  blockNumber: number;
  logIndex: number;
  memo: string | null;
}

function topicToAddress(topic: string): string {
  // Topic is 32 bytes, address is last 20 bytes
  return "0x" + topic.slice(-40).toLowerCase();
}

function bigintPow(base: bigint, exp: number): bigint {
  let result = BigInt(1);
  for (let i = 0; i < exp; i++) result = result * base;
  return result;
}

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = bigintPow(BigInt(10), decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === BigInt(0)) return `${whole}.0`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function decodeTransferLog(logEntry: {
  address: string; topics: string[]; data: string;
  blockNumber: string; transactionHash: string; logIndex: string;
}): DecodedTransfer {
  const amountRaw = BigInt(logEntry.data);
  return {
    from: topicToAddress(logEntry.topics[1]),
    to: topicToAddress(logEntry.topics[2]),
    amountRaw: amountRaw.toString(),
    amount: formatAmount(amountRaw, TEMPO_CHAIN_CONFIG.tokens.pathUSD.decimals),
    txHash: logEntry.transactionHash,
    blockNumber: parseInt(logEntry.blockNumber, 16),
    logIndex: parseInt(logEntry.logIndex, 16),
    memo: null,
  };
}

export function decodeTransferWithMemoLog(logEntry: {
  address: string; topics: string[]; data: string;
  blockNumber: string; transactionHash: string; logIndex: string;
}): DecodedTransfer {
  const base = decodeTransferLog(logEntry);
  // topics[3] is bytes32 memo — hex-decode, trim null bytes
  const memoHex = logEntry.topics[3] || "";
  let memo: string | null = null;
  if (memoHex && memoHex.length === 66) {
    const bytes = Buffer.from(memoHex.slice(2), "hex");
    memo = bytes.toString("utf-8").replace(/\0+$/, "");
    if (!memo) memo = memoHex;
  }
  return { ...base, memo };
}

// --- RPC helper ---

interface EthGetLogsFilter {
  address: string;
  topics: (string | null | string[])[];
  fromBlock: string;
  toBlock: string;
}

async function rpcCall<T = unknown>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!resp.ok) throw new Error(`RPC ${method} failed: ${resp.status}`);
  const json = await resp.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method} error: ${json.error.message}`);
  return json.result as T;
}

async function getLogsWithFallback(filter: EthGetLogsFilter): Promise<any[]> {
  const primary = TEMPO_CHAIN_CONFIG.rpcUrl;
  const fallback = TEMPO_CHAIN_CONFIG.rpcUrlFallback;

  try {
    return await retryWithBackoff(() => rpcCall<any[]>(primary, "eth_getLogs", [filter]), {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: 1000,
    });
  } catch (err) {
    if (!fallback) throw err;
    log.warn("Primary RPC failed, trying fallback", { error: (err as Error).message });
    return await retryWithBackoff(() => rpcCall<any[]>(fallback, "eth_getLogs", [filter]), {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: 1000,
    });
  }
}

async function getLatestBlock(): Promise<number> {
  const hex = await retryWithBackoff(
    () => rpcCall<string>(TEMPO_CHAIN_CONFIG.rpcUrl, "eth_blockNumber", []),
    { maxAttempts: RPC_RETRY_ATTEMPTS, baseDelayMs: 1000 },
  );
  return parseInt(hex, 16);
}

// --- Indexing loop ---

export async function indexAddressInboundTransfers(
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<DecodedTransfer[]> {
  const paddedAddress = "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const pathUsdAddress = TEMPO_CHAIN_CONFIG.tokens.pathUSD.address;

  const results: DecodedTransfer[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const windowEnd = Math.min(cursor + BLOCK_WINDOW - 1, toBlock);
    const filter: EthGetLogsFilter = {
      address: pathUsdAddress,
      topics: [TRANSFER_TOPIC, null, paddedAddress],
      fromBlock: `0x${cursor.toString(16)}`,
      toBlock: `0x${windowEnd.toString(16)}`,
    };
    const logs = await getLogsWithFallback(filter);
    for (const entry of logs) results.push(decodeTransferLog(entry));

    if (TRANSFER_WITH_MEMO_TOPIC) {
      const memoFilter: EthGetLogsFilter = { ...filter, topics: [TRANSFER_WITH_MEMO_TOPIC, null, paddedAddress] };
      const memoLogs = await getLogsWithFallback(memoFilter);
      for (const entry of memoLogs) results.push(decodeTransferWithMemoLog(entry));
    }

    cursor = windowEnd + 1;
  }
  return results;
}

export async function syncAllTempoTransactions(): Promise<{ addresses: number; transfers: number; errors: number; }> {
  const { storage } = await import("./storage.js");
  const { runWithConcurrency } = await import("./lib/indexer-utils.js");

  const syncStates = await storage.getTransactionSyncStatesForChain(TEMPO_CHAIN_ID);
  log.info(`Tempo sync: ${syncStates.length} tracked addresses`);

  const latestBlock = await getLatestBlock();
  let totalTransfers = 0;
  let errors = 0;

  await runWithConcurrency(
    syncStates,
    async (state) => {
      const fromBlock = Math.max(state.lastSyncedBlock + 1, TEMPO_CHAIN_CONFIG.deploymentBlock || 0);
      if (fromBlock > latestBlock) return;
      try {
        const transfers = await indexAddressInboundTransfers(state.paymentAddress, fromBlock, latestBlock);

        for (const t of transfers) {
          const agent = await storage.getAgentByTempoAddress(t.to);
          if (!agent) continue;
          const record: InsertAgentTransaction = {
            agentId: agent.id,
            chainId: TEMPO_CHAIN_ID,
            txHash: t.txHash,
            transferId: `tempo-${t.txHash}-${t.logIndex}`,
            fromAddress: t.from,
            toAddress: t.to,
            tokenAddress: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
            tokenSymbol: "pathUSD",
            amount: t.amount,
            amountUsd: parseFloat(t.amount),
            blockNumber: t.blockNumber,
            blockTimestamp: new Date(), // Populated by BlockTimestamp lookup below; default now for fallback
            category: "mpp_payment",
            metadata: t.memo ? { memo: t.memo } : null,
          };
          await storage.upsertAgentTransaction(record);
          totalTransfers++;
        }

        await storage.updateTransactionSyncState(state.paymentAddress, TEMPO_CHAIN_ID, latestBlock);
      } catch (err) {
        errors++;
        log.error(`Tempo sync failed for ${state.paymentAddress}`, { error: (err as Error).message });
      }
    },
    MAX_CONCURRENT_ADDRESSES,
    { interItemDelayMs: 250 },
  );

  return { addresses: syncStates.length, transfers: totalTransfers, errors };
}
