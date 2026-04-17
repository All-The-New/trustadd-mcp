import type { Request, Response, NextFunction, RequestHandler } from "express";

/** One priced endpoint in the Trust Data Product. */
export interface PaymentRoute {
  method: "GET" | "POST";
  /** Express-style path, e.g. "/api/v1/trust/:address". */
  path: string;
  /** Canonical price string ("$0.01"). Adapters interpret into their own token units. */
  price: string;
  /** Price in pathUSD base units (6-decimal, bigint string). Mirrors `price`. */
  priceBaseUnits: string;
  description: string;
}

/** A payment protocol (x402, MPP, future). */
export interface PaymentAdapter {
  /** Short id used in logs. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /**
   * If this adapter can verify the request's attached payment, verify it
   * and return `{ verified: true }`. If the request carries no payment
   * payload for this adapter, return `{ verified: false }` (no error) so
   * other adapters get a chance. Only throw on internal errors.
   */
  tryVerify(req: Request, route: PaymentRoute): Promise<VerificationResult>;
  /**
   * Produce the challenge this adapter wants to include in the combined
   * 402 response, or `null` if this adapter has no challenge for this route.
   */
  challenge(route: PaymentRoute): PaymentChallenge | null;
}

export type VerificationResult =
  | { verified: true }
  | { verified: false; reason?: string };

export interface PaymentChallenge {
  /** Value to append to the `WWW-Authenticate` header. */
  wwwAuthenticate: string;
  /** Structured description for the JSON 402 body. */
  body: Record<string, unknown>;
}

export type PaymentMiddleware = RequestHandler;
