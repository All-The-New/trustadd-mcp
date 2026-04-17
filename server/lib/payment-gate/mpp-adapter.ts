import type { Request } from "express";
import type { PaymentAdapter, PaymentChallenge, PaymentRoute, VerificationResult } from "./types.js";
import { TEMPO_CHAIN_CONFIG, TEMPO_CHAIN_ID } from "../../../shared/chains.js";
import { buildMppChallenge, parseMppPaymentHeader } from "./mpp-challenge.js";
import { verifyTempoPayment } from "./tempo-verifier.js";
import { ReplayCache } from "./replay-cache.js";
import { log } from "../log.js";

export interface MppAdapterConfig {
  recipient: string;
  rpcUrl: string;
  realm: string;
}

const REPLAY_TTL_MS = 60 * 60 * 1000; // 1h
const REPLAY_MAX = 10_000;

/**
 * MPP (pathUSD on Tempo) payment adapter.
 * Returns null from factory if required env is missing.
 */
export function createMppAdapter(): PaymentAdapter | null {
  const recipient = process.env.MPP_PAY_TO_ADDRESS?.toLowerCase();
  const rpcUrl = process.env.TEMPO_RPC_URL || TEMPO_CHAIN_CONFIG.rpcUrl;

  if (!recipient || !/^0x[0-9a-f]{40}$/.test(recipient)) {
    log("mpp adapter disabled: MPP_PAY_TO_ADDRESS unset or malformed", "payment-gate");
    return null;
  }
  if (!rpcUrl) {
    log("mpp adapter disabled: no Tempo RPC URL", "payment-gate");
    return null;
  }

  const replay = new ReplayCache({ ttlMs: REPLAY_TTL_MS, maxSize: REPLAY_MAX });
  const cfg: MppAdapterConfig = { recipient, rpcUrl, realm: "trustadd.com" };

  log(`mpp adapter enabled: recipient=${recipient} rpc=${rpcUrl}`, "payment-gate");

  return {
    id: "mpp",
    label: "MPP (pathUSD on Tempo)",
    challenge(route: PaymentRoute): PaymentChallenge {
      const id = `trust-${route.path.replace(/[^a-z0-9]/gi, "-")}-${route.priceBaseUnits}`;
      const header = buildMppChallenge({
        id,
        realm: cfg.realm,
        recipient: cfg.recipient,
        asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
        amountBaseUnits: route.priceBaseUnits,
        chainId: TEMPO_CHAIN_ID,
      });
      return {
        wwwAuthenticate: header,
        body: {
          scheme: "mpp",
          method: "tempo",
          intent: "charge",
          chainId: TEMPO_CHAIN_ID,
          recipient: cfg.recipient,
          asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
          assetSymbol: "pathUSD",
          amount: route.priceBaseUnits,
          price: route.price,
        },
      };
    },
    async tryVerify(req: Request, route: PaymentRoute): Promise<VerificationResult> {
      const raw = req.header("x-payment") ?? req.header("authorization");
      const parsed = parseMppPaymentHeader(raw ?? undefined);
      if (!parsed) return { verified: false }; // not an MPP payment → defer

      const replayKey = `${parsed.txHash}:${parsed.logIndex ?? "*"}`;
      if (replay.has(replayKey)) {
        return { verified: false, reason: "replay" };
      }

      const result = await verifyTempoPayment({
        txHash: parsed.txHash,
        recipient: cfg.recipient,
        asset: TEMPO_CHAIN_CONFIG.tokens.pathUSD.address,
        minAmountBaseUnits: route.priceBaseUnits,
        rpcUrl: cfg.rpcUrl,
      });
      if (!result.verified) return { verified: false, reason: result.reason };

      replay.add(`${parsed.txHash}:${result.logIndex ?? "*"}`);
      replay.add(replayKey); // defensive
      return { verified: true };
    },
  };
}
