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
      "args": ["-y", "@trustadd/mcp"],
      "env": { "TRUSTADD_API_KEY": "your_bearer_token_here" }
    }
  }
}
```

### Cursor

```json
{
  "trustadd": {
    "command": "npx",
    "args": ["-y", "@trustadd/mcp"],
    "env": { "TRUSTADD_API_KEY": "your_bearer_token_here" }
  }
}
```

## Tools

### Trust (agent due-diligence)

| Tool | Purpose |
|------|---------|
| `lookup_agent` | Check if TrustAdd has data + verdict preview |
| `check_agent_trust` | Score (0-100), verdict, 5-category breakdown |
| `get_trust_report` | Full profile: identity, on-chain, economic, community |

### MPP (Multi-Protocol Payment ecosystem)

| Tool | Purpose |
|------|---------|
| `mpp_directory_stats` | Directory aggregate stats |
| `mpp_adoption_stats` | Cross-protocol adoption counts (MPP vs x402) |
| `mpp_chain_stats` | Tempo chain volume/tx/payer metrics |
| `mpp_search_services` | Paginated directory search (category, method, text) |

### Analytics (ecosystem research)

| Tool | Purpose |
|------|---------|
| `ecosystem_overview` | Aggregate ecosystem metrics |
| `chain_distribution` | Agent counts per chain |
| `list_supported_chains` | Chain metadata registry |

### Status

| Tool | Purpose |
|------|---------|
| `trustadd_status` | Service health, pipeline breakers, API versions |

## Prompts

### `agent_trust_gate`

Guides an agent framework through a trust-gated transaction decision flow (lookup → check → decision). Args: `counterparty: 0x-address`, `context?: string`.

## Rate Limits & API Key

All tools are free. Anonymous callers get a generous best-effort quota; setting a free API key (`TRUSTADD_API_KEY`) raises the daily ceiling 10–50×.

**Get a key:**

1. Visit https://trustadd.com/register
2. Enter your email
3. Open the registration email — it contains your bearer key + a verification link
4. Click the verification link to activate the key (the page confirms activation; the key itself is only delivered by email)

**Use the key:**

```json
{
  "mcpServers": {
    "trustadd": {
      "command": "npx",
      "args": ["-y", "@trustadd/mcp"],
      "env": { "TRUSTADD_API_KEY": "your_bearer_token_here" }
    }
  }
}
```

When the key is set, every API call is sent with `Authorization: Bearer <key>` and the server applies the registered-tier limits. If you hit a rate limit, the tool returns an actionable error including the registration link.

See [docs/api-rate-limits.md](https://github.com/All-The-New/trustadd/blob/main/docs/api-rate-limits.md) for the full bucket table.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTADD_API_KEY` | (none) | Optional bearer token for the registered rate-limit tier. Register at https://trustadd.com/register. |
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
- [Rate Limits](https://github.com/All-The-New/trustadd/blob/main/docs/api-rate-limits.md)
- [Changelog](./CHANGELOG.md)
