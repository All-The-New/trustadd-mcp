import type { PaymentRoute } from "./types.js";

/** Single source of truth for every priced Trust API endpoint. */
export const TRUST_PRODUCT_ROUTES: readonly PaymentRoute[] = [
  {
    method: "GET",
    path: "/api/v1/trust/:address",
    price: "$0.01",
    priceBaseUnits: "10000", // 0.01 * 10^6
    description: "Agent trust quick check",
  },
  {
    method: "GET",
    path: "/api/v1/trust/:address/report",
    price: "$0.05",
    priceBaseUnits: "50000", // 0.05 * 10^6
    description: "Full agent trust report with evidence",
  },
] as const;

/** Match an Express `req.method` + `req.path` against the route table. */
export function matchRoute(method: string, path: string): PaymentRoute | null {
  for (const r of TRUST_PRODUCT_ROUTES) {
    if (r.method !== method) continue;
    const regex = new RegExp(
      "^" + r.path.replace(/:[^/]+/g, "[^/]+") + "$",
    );
    if (regex.test(path)) return r;
  }
  return null;
}
