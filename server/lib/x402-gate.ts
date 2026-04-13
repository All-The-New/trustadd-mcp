import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm";
import { createFacilitatorConfig } from "@coinbase/x402";
import type { RequestHandler } from "express";
import { log } from "./log.js";

const BASE_NETWORK = "eip155:8453" as const;

/**
 * Creates the x402 payment middleware for Trust Data Product endpoints.
 * Returns null if required environment variables are not configured.
 */
export function createTrustProductGate(): RequestHandler | null {
  const payTo = process.env.TRUST_PRODUCT_PAY_TO;
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpPrivateKey = process.env.CDP_PRIVATE_KEY;

  if (!payTo || !cdpKeyId || !cdpPrivateKey) {
    log("x402 gate disabled: missing TRUST_PRODUCT_PAY_TO, CDP_API_KEY_ID, or CDP_PRIVATE_KEY", "x402-gate");
    return null;
  }

  // Configure CDP facilitator with auth
  const facilitatorConfig = createFacilitatorConfig(cdpKeyId, cdpPrivateKey);
  const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);

  // Create resource server with EVM scheme for Base
  const server = new x402ResourceServer(facilitatorClient)
    .register(BASE_NETWORK, new ExactEvmScheme());

  // Route pricing configuration
  const routes: RoutesConfig = {
    "GET /api/v1/trust/:address": {
      accepts: [{
        scheme: "exact",
        price: "$0.01",
        network: BASE_NETWORK,
        payTo,
      }],
      description: "Agent trust quick check",
      mimeType: "application/json",
    },
    "GET /api/v1/trust/:address/report": {
      accepts: [{
        scheme: "exact",
        price: "$0.05",
        network: BASE_NETWORK,
        payTo,
      }],
      description: "Full agent trust report with evidence",
      mimeType: "application/json",
    },
  };

  log(`x402 gate enabled: payTo=${payTo}, network=${BASE_NETWORK}`, "x402-gate");

  return paymentMiddleware(routes, server);
}
