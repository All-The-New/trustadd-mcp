import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PaymentAdapter, PaymentMiddleware, PaymentRoute } from "./types.js";
import { TRUST_PRODUCT_ROUTES, matchRoute } from "./routes.js";
import { createX402Adapter } from "./x402-adapter.js";
import { createMppAdapter } from "./mpp-adapter.js";
import { log } from "../log.js";

export type { PaymentAdapter, PaymentRoute } from "./types.js";
export { TRUST_PRODUCT_ROUTES } from "./routes.js";

/**
 * Build the payment gate middleware from the adapters configured by env.
 * Returns null only if NO adapter is configured — callers decide whether
 * that's fatal or acceptable.
 */
export function createPaymentGate(): PaymentMiddleware | null {
  const adapters: PaymentAdapter[] = [];
  const x402 = createX402Adapter();
  if (x402) adapters.push(x402);
  const mpp = createMppAdapter();
  if (mpp) adapters.push(mpp);

  if (adapters.length === 0) {
    log("payment gate disabled: no adapters configured", "payment-gate");
    return null;
  }
  log(`payment gate active with adapters: ${adapters.map(a => a.id).join(", ")}`, "payment-gate");
  return composePaymentGate(adapters);
}

/**
 * Exported for tests — compose an explicit adapter list.
 */
export function composePaymentGate(adapters: PaymentAdapter[]): RequestHandler {
  return async function paymentGate(req: Request, res: Response, next: NextFunction) {
    const route = matchRoute(req.method, req.path);
    if (!route) return next();

    for (const adapter of adapters) {
      try {
        const result = await adapter.tryVerify(req, route);
        if (result.verified) return next();
      } catch (err) {
        log(`adapter ${adapter.id} verification error: ${(err as Error).message}`, "payment-gate");
      }
    }

    // No adapter verified → emit combined 402.
    const challenges = adapters
      .map((a) => ({ id: a.id, label: a.label, challenge: a.challenge(route) }))
      .filter((c): c is { id: string; label: string; challenge: NonNullable<ReturnType<PaymentAdapter["challenge"]>> } => c.challenge !== null);

    for (const c of challenges) {
      res.appendHeader("WWW-Authenticate", c.challenge.wwwAuthenticate);
    }
    res.status(402).json({
      error: "Payment Required",
      price: route.price,
      description: route.description,
      accepts: challenges.map((c) => ({
        adapter: c.id,
        label: c.label,
        ...c.challenge.body,
      })),
    });
  };
}
