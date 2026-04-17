export interface MppChallengeInput {
  id: string;
  realm: string;
  recipient: string;
  asset: string;
  amountBaseUnits: string;
  chainId: number;
}

/**
 * Build a WWW-Authenticate: Payment header per IETF draft-ryan-httpauth-payment-00.
 * Mirrors the format the `mpp-prober` already parses.
 */
export function buildMppChallenge(input: MppChallengeInput): string {
  const requestPayload = {
    recipient: input.recipient.toLowerCase(),
    asset: input.asset.toLowerCase(),
    amount: input.amountBaseUnits,
    chainId: input.chainId,
  };
  const json = JSON.stringify(requestPayload);
  const b64url = Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return (
    `Payment id="${input.id}", realm="${input.realm}", method="tempo", ` +
    `intent="charge", request="${b64url}"`
  );
}

export interface ParsedMppPayment {
  txHash: string;
  logIndex?: number;
}

/**
 * Parse an `Authorization` (or `X-Payment`) header carrying an MPP proof.
 * Accepts either `MPP <txHash>` or `MPP tx="0x.." logIndex="N"` forms.
 */
export function parseMppPaymentHeader(value: string | undefined): ParsedMppPayment | null {
  if (!value) return null;
  const m = /^MPP\s+(.+)$/i.exec(value.trim());
  if (!m) return null;
  const body = m[1].trim();

  // Simple form: raw tx hash
  const simple = /^(0x[0-9a-fA-F]+)$/.exec(body);
  if (simple) return { txHash: simple[1].toLowerCase() };

  // Parameterized form
  const params: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
  let hit;
  while ((hit = re.exec(body)) !== null) params[hit[1]] = hit[2];
  if (!params.tx) return null;
  const out: ParsedMppPayment = { txHash: params.tx.toLowerCase() };
  if (params.logIndex) out.logIndex = Number.parseInt(params.logIndex, 10);
  return out;
}
