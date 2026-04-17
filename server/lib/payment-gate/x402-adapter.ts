import type { Request, Response, NextFunction, RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

import type { PaymentAdapter, PaymentChallenge, PaymentRoute, VerificationResult } from "./types.js";
import { TRUST_PRODUCT_ROUTES } from "./routes.js";
import { log } from "../log.js";

const BASE_NETWORK = "eip155:8453" as const;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC

export function createX402Adapter(): PaymentAdapter | null {
  const payTo = process.env.TRUST_PRODUCT_PAY_TO;
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpPrivateKey = process.env.CDP_PRIVATE_KEY;

  if (!payTo || !cdpKeyId || !cdpPrivateKey) {
    log("x402 adapter disabled: missing TRUST_PRODUCT_PAY_TO / CDP_API_KEY_ID / CDP_PRIVATE_KEY", "payment-gate");
    return null;
  }

  let middleware: RequestHandler;
  try {
    const facilitatorConfig = createFacilitatorConfig(cdpKeyId, cdpPrivateKey);
    const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);
    const server = new x402ResourceServer(facilitatorClient).register(BASE_NETWORK, new ExactEvmScheme());

    const routes: RoutesConfig = {};
    for (const r of TRUST_PRODUCT_ROUTES) {
      routes[`${r.method} ${r.path}`] = {
        accepts: [{ scheme: "exact", price: r.price, network: BASE_NETWORK, payTo }],
        description: r.description,
        mimeType: "application/json",
      };
    }
    middleware = paymentMiddleware(routes, server);
  } catch (err) {
    log(`x402 adapter construction failed: ${(err as Error).message}`, "payment-gate");
    return null;
  }

  log(`x402 adapter enabled: payTo=${payTo}, network=${BASE_NETWORK}`, "payment-gate");

  return {
    id: "x402",
    label: "x402 (USDC on Base)",
    challenge(route: PaymentRoute): PaymentChallenge {
      // Static description — the composed gate renders the combined body,
      // we just provide the x402-shaped entry.
      return {
        wwwAuthenticate: `x402 scheme="exact", network="${BASE_NETWORK}", asset="USDC", amount="${route.price}"`,
        body: {
          scheme: "exact",
          network: BASE_NETWORK,
          asset: "USDC",
          assetAddress: USDC_BASE,
          payTo,
          price: route.price,
        },
      };
    },
    async tryVerify(req: Request, _route: PaymentRoute): Promise<VerificationResult> {
      // Delegate to upstream middleware with a captured next/res. If it calls
      // next(), payment is valid. If it returns a 402, we treat as "not
      // presented" so the composed gate can emit the combined challenge.
      return new Promise<VerificationResult>((resolve) => {
        let decided = false;
        const fakeRes: Partial<Response> = {
          status(code: number) {
            if (code === 402 && !decided) {
              decided = true;
              resolve({ verified: false });
            }
            return this as Response;
          },
          json(_body: unknown) { return this as Response; },
          set() { return this as Response; },
          setHeader() { return this as Response; },
          end() { return this as Response; },
          send() { return this as Response; },
        };
        const next: NextFunction = (err?: unknown) => {
          if (decided) return;
          decided = true;
          if (err) resolve({ verified: false, reason: String(err) });
          else resolve({ verified: true });
        };
        try {
          middleware(req, fakeRes as unknown as Response, next);
        } catch (err) {
          if (!decided) {
            decided = true;
            resolve({ verified: false, reason: (err as Error).message });
          }
        }
      });
    },
  };
}
