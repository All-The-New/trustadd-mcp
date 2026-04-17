import { z } from "zod";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const AddressSchema = z
  .string()
  .regex(ADDRESS_RE)
  .describe("EVM address (0x-prefixed, 40 hex chars) — contract, controller, or payment address");

/** Supported EVM chain IDs across TrustAdd (9 EVM + Tempo). */
export const SUPPORTED_CHAIN_IDS = [1, 10, 56, 100, 137, 8453, 42161, 42220, 43114, 4217] as const;

export const ChainIdSchema = z
  .number()
  .int()
  .refine((n) => (SUPPORTED_CHAIN_IDS as readonly number[]).includes(n), {
    message: `chainId must be one of: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
  })
  .describe(
    "Optional chain ID to narrow lookup. Supported: 1 (Ethereum), 10 (Optimism), 56 (BNB), 100 (Gnosis), 137 (Polygon), 8453 (Base), 42161 (Arbitrum), 42220 (Celo), 43114 (Avalanche), 4217 (Tempo)"
  );
