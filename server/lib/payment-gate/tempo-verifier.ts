import { decodeTransferLog } from "../../tempo-transaction-indexer.js";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface TempoVerifyInput {
  txHash: string;
  recipient: string;        // lowercase 0x…
  asset: string;            // pathUSD contract address, lowercase
  minAmountBaseUnits: string;
  rpcUrl: string;
}

export interface TempoVerifyResult {
  verified: boolean;
  reason?: string;
  logIndex?: number;
}

interface RpcReceipt {
  status: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    logIndex: string;
  }>;
}

export async function verifyTempoPayment(input: TempoVerifyInput): Promise<TempoVerifyResult> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getTransactionReceipt",
    params: [input.txHash],
  };
  let resp: Response;
  try {
    resp = await fetch(input.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { verified: false, reason: `rpc-error: ${(err as Error).message}` };
  }
  if (!resp.ok) return { verified: false, reason: `rpc-http-${resp.status}` };

  const json = (await resp.json()) as { result: RpcReceipt | null; error?: unknown };
  const receipt = json.result;
  if (!receipt) return { verified: false, reason: "receipt-not-found" };
  if (receipt.status !== "0x1") return { verified: false, reason: "tx-reverted" };

  const recipient = input.recipient.toLowerCase();
  const asset = input.asset.toLowerCase();
  const minAmount = BigInt(input.minAmountBaseUnits);

  for (const logEntry of receipt.logs) {
    if (logEntry.address.toLowerCase() !== asset) continue;
    if (logEntry.topics[0] !== TRANSFER_TOPIC) continue;

    const decoded = decodeTransferLog(logEntry);
    if (decoded.to !== recipient) continue;
    if (BigInt(decoded.amountRaw) < minAmount) continue;
    return { verified: true, logIndex: decoded.logIndex };
  }
  return { verified: false, reason: "no-matching-transfer" };
}
