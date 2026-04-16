/**
 * MPP endpoint prober and WWW-Authenticate: Payment header parser.
 *
 * MPP challenge format (IETF draft-ryan-httpauth-payment-00):
 *   WWW-Authenticate: Payment id="<id>", realm="<domain>", method="<method>",
 *     intent="<intent>", request="<base64url-encoded JSON>"
 *
 * Multiple Payment headers can coexist on one response; the client picks one.
 */

export interface ParsedPaymentChallenge {
  id: string;
  realm: string;
  method: string;      // tempo | stripe | lightning | ...
  intent: string;      // charge | stream | session
  request: Record<string, unknown> | null;
  raw: string;
}

/**
 * Parse a single WWW-Authenticate: Payment header value.
 * Returns null if the header is not a valid Payment challenge.
 */
export function parsePaymentAuthHeader(header: string): ParsedPaymentChallenge | null {
  if (!header) return null;

  // Strip optional leading "Payment " scheme token
  const trimmed = header.trim();
  const match = /^Payment\s+(.*)$/i.exec(trimmed);
  if (!match) return null;

  const params = parseAuthParams(match[1]);
  if (!params.id || !params.method) return null;

  let decodedRequest: Record<string, unknown> | null = null;
  if (params.request) {
    try {
      const json = base64UrlDecode(params.request);
      decodedRequest = JSON.parse(json);
    } catch {
      // Preserve raw challenge even if request payload is unreadable
      decodedRequest = null;
    }
  }

  return {
    id: params.id,
    realm: params.realm ?? "",
    method: params.method,
    intent: params.intent ?? "charge",
    request: decodedRequest,
    raw: header,
  };
}

/**
 * Parse multiple WWW-Authenticate header values (multi-method endpoints).
 * Non-Payment and malformed entries are filtered out.
 */
export function parseAllPaymentAuthHeaders(headers: string[]): ParsedPaymentChallenge[] {
  const out: ParsedPaymentChallenge[] = [];
  for (const h of headers) {
    const parsed = parsePaymentAuthHeader(h);
    if (parsed) out.push(parsed);
  }
  return out;
}

// --- internals ---

function parseAuthParams(input: string): Record<string, string> {
  // Parses comma-separated `key="value"` pairs, respecting quoted strings.
  const result: Record<string, string> = {};
  const re = /(\w+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    result[m[1]] = m[2].replace(/\\(.)/g, "$1");
  }
  return result;
}

function base64UrlDecode(input: string): string {
  // base64url -> base64
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}
