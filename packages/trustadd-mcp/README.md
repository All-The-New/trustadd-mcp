# @trustadd/mcp

MCP server for **TrustAdd** — the AI agent trust oracle. Check trust scores, explore the Multi-Protocol Payment (MPP) ecosystem, and query cross-chain analytics for ERC-8004 agents across 9 EVM chains + Tempo.

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

```json
{
  "trustadd": {
    "command": "npx",
    "args": ["-y", "@trustadd/mcp"]
  }
}
```

## Tools

### Trust (agent due-diligence)

| Tool | Cost | Purpose |
|------|------|---------|
| `lookup_agent` | Free | Check if TrustAdd has data + verdict preview |
| `check_agent_trust` | $0.01 USDC | Score (0-100), verdict, 5-category breakdown |
| `get_trust_report` | $0.05 USDC | Full profile: identity, on-chain, economic, community |

### MPP (Multi-Protocol Payment ecosystem)

| Tool | Cost | Purpose |
|------|------|---------|
| `mpp_directory_stats` | Free | Directory aggregate stats |
| `mpp_adoption_stats` | Free | Cross-protocol adoption counts (MPP vs x402) |
| `mpp_chain_stats` | Free | Tempo chain volume/tx/payer metrics |
| `mpp_search_services` | Free | Paginated directory search (category, method, text) |

### Analytics (ecosystem research)

| Tool | Cost | Purpose |
|------|------|---------|
| `ecosystem_overview` | Free | Aggregate ecosystem metrics |
| `chain_distribution` | Free | Agent counts per chain |
| `list_supported_chains` | Free | Chain metadata registry |

### Status

| Tool | Cost | Purpose |
|------|------|---------|
| `trustadd_status` | Free | Service health, pipeline breakers, API versions |

## Prompts

### `agent_trust_gate`

Guides an agent framework through a trust-gated transaction decision flow (lookup → check → decision). Args: `counterparty: 0x-address`, `context?: string`.

## x402 Payment

The paid tools (`check_agent_trust`, `get_trust_report`) are gated by the x402 protocol. When called without payment, they return the payment requirements (price, network, token) so you or your agent framework can complete payment via the REST API directly.

**Payment details:**
- Network: Base (Chain ID 8453)
- Token: USDC
- Protocol: x402 (gasless for the payer)

For automated payment, use an x402-compatible HTTP client against the TrustAdd REST API at `https://trustadd.com/api/v1/trust/`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTADD_API_URL` | `https://trustadd.com` | Override API base URL (for testing) |
| `TRUSTADD_API_VERSION_OVERRIDE` | (none) | Override versioned-group API version (e.g. `v2`). Only affects groups registered as versioned in `lib/versioning.ts`. |

## Versioning

The MCP server maps each tool group to an API version via `src/lib/versioning.ts`:

- `trust` → `v1` (versioned URL prefix `/api/v1/trust/...`)
- `mpp`, `analytics`, `status` → unversioned (server-side routes are currently stable)

When TrustAdd ships `/api/v2/trust/`, a single-line change in `versioning.ts` + minor version bump migrates every trust tool.

## Supported Chains

Ethereum (1), BNB Chain (56), Polygon (137), Arbitrum (42161), Base (8453), Celo (42220), Gnosis (100), Optimism (10), Avalanche (43114), Tempo (4217).

## Development

```bash
npm install
npm test            # watch mode
npm run test:run    # CI mode
npm run build
```

## Links

- [TrustAdd](https://trustadd.com)
- [API Docs](https://trustadd.com/docs/trust-api)
- [Product Spec](https://github.com/All-The-New/trustadd/blob/main/docs/trust-product.md)
- [Changelog](./CHANGELOG.md)
