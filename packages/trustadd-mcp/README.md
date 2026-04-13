# @trustadd/mcp

MCP server for **TrustAdd** — the AI agent trust oracle. Check trust scores and get detailed trust reports for ERC-8004 agents across 9 EVM chains before transacting.

## Quick Start

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "trustadd": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@trustadd/mcp"]
    }
  }
}
```

### Cursor

Add to MCP settings:

```json
{
  "trustadd": {
    "command": "npx",
    "args": ["-y", "@trustadd/mcp"]
  }
}
```

## Tools

### `lookup_agent` (Free)

Check if TrustAdd has data on an address. No payment required.

**Input:** `{ address: "0x..." }`

**Returns:** Whether the agent exists, a verdict preview, and pricing for paid tools.

### `check_agent_trust` ($0.01 USDC)

Get a trust verdict with score breakdown. Requires x402 payment.

**Input:** `{ address: "0x...", chainId?: 8453 }`

**Returns:** Score (0-100), verdict (TRUSTED/CAUTION/UNTRUSTED), breakdown across 5 categories, flags, and key metrics.

### `get_trust_report` ($0.05 USDC)

Get a comprehensive trust report with full evidence. Requires x402 payment.

**Input:** `{ address: "0x...", chainId?: 8453 }`

**Returns:** Complete trust profile including identity, on-chain history, economic activity, community signals, and data freshness.

## x402 Payment

The paid tools (`check_agent_trust`, `get_trust_report`) are gated by the x402 protocol. When called without payment, they return the payment requirements (price, network, token) so you or your agent framework can complete payment via the REST API directly.

**Payment details:**
- Network: Base (Chain ID 8453)
- Token: USDC
- Protocol: x402 (gasless for the payer)

For automated payment, use an x402-compatible HTTP client against the TrustAdd REST API at `https://trustadd.com/api/v1/trust/`.

## Agent Trust Gate Pattern

Before transacting with any agent:

```
1. lookup_agent(counterparty_address)     # Free — check if data exists
2. check_agent_trust(counterparty_address) # $0.01 — get verdict
3. If TRUSTED → proceed
   If CAUTION → get_trust_report for details
   If UNTRUSTED → abort
   If UNKNOWN → proceed with caution
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTADD_API_URL` | `https://trustadd.com` | Override API base URL (for testing) |

## Supported Chains

Agents registered on any of these chains are discoverable:

Ethereum (1), BNB Chain (56), Polygon (137), Arbitrum (42161), Base (8453), Celo (42220), Gnosis (100), Optimism (10), Avalanche (43114)

## Links

- [TrustAdd](https://trustadd.com) — Live platform
- [API Docs](https://trustadd.com/docs/trust-api) — Full API documentation
- [Product Spec](https://github.com/All-The-New/trustadd/blob/main/docs/trust-product.md) — Detailed specification
