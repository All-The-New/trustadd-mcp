# Changelog

All notable changes to `@trustadd/mcp` are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-10

### BREAKING

- **All trust tools are now free.** The x402 payment flow has been removed from `@trustadd/mcp`. The TrustAdd backend no longer emits HTTP 402 for these endpoints (Phase 1 of the x402 rollback, [commit 52e582a](https://github.com/All-The-New/trustadd/commit/52e582a)).
- `paidHandler` is removed from `src/lib/api.ts`. Callers should use `apiHandler` instead.
- The `paymentRequired` / `quickCheckPrice` / `fullReportPrice` / `paymentMethods` fields are no longer present in any tool response.

### Added

- `TRUSTADD_API_KEY` env variable — when set, every request to the TrustAdd API is sent with `Authorization: Bearer <key>` for the registered-tier rate-limit bucket. Register at https://trustadd.com/register (free).
- `readApiKey()` helper in `src/lib/auth.ts` (single source of truth, trims whitespace).
- 429 error messages now include an actionable hint pointing anonymous callers to the registration page.

### Changed

- `paidHandler` + `freeHandler` collapsed into a single `apiHandler(path, opts)` in `src/lib/api.ts`.
- Tool descriptions updated to describe the free + API-key model.
- `agent_trust_gate` prompt updated: step 2 no longer mentions `$0.01` or "verdict 402"; step 5 added pointing rate-limited callers to register.

### Removed

- `paidHandler` export from `src/lib/api.ts`.
- The 402 / payment-required branch from API responses.
- `$0.01` / `$0.05` / `x402 protocol` strings from tool descriptions and prompts (kept where they describe indexed-ecosystem facts, e.g. `mpp_adoption_stats`).
- `x402` from `package.json` keywords.

### Migration

If you were on v1.x and depending on the `paymentRequired` response shape, that branch will never fire against the production API again. The trust tools now return the same data structure they previously returned *after* successful payment — there is no migration step beyond updating the dependency.

To enable the registered-tier rate-limit bucket (10–50× higher daily caps), set `TRUSTADD_API_KEY` in your environment:

```bash
# Get a key at https://trustadd.com/register (free, 30 seconds, magic-link verify)
# The bearer is emailed to you and is a 43-char base64url token with no prefix.
export TRUSTADD_API_KEY=your_bearer_token_here
```

Or in your MCP client config:

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

## [1.1.0] — 2026-04-17

### Added

- 4 MPP tools: `mpp_directory_stats`, `mpp_adoption_stats`, `mpp_chain_stats`, `mpp_search_services`
- 3 free analytics tools: `ecosystem_overview`, `chain_distribution`, `list_supported_chains`
- 1 status tool: `trustadd_status` (exposes API health, pipeline breakers, active API versions)
- 1 MCP prompt: `agent_trust_gate` (guides agent frameworks through a trust-gated transaction flow)
- Modular file structure: `src/lib/`, `src/tools/`, `src/prompts/`
- API version registry (`src/lib/versioning.ts`) with `TRUSTADD_API_VERSION_OVERRIDE` env support
- Vitest test suite covering the API client, versioning layer, and every tool group
- GitHub Actions workflow for automated npm publish on `mcp-v*` tag

### Changed

- `src/index.ts` reduced from 166 lines to a bootstrap-only file
- Address + chainId validation centralized into `src/lib/schemas.ts`
- Chain ID schema now validates against the 10 supported chains (9 EVM + Tempo)

### Removed

- Nothing (all three v1.0.0 tools preserved with identical signatures)

## [1.0.0] — 2026-04-10

### Added

- Initial release with 3 trust tools: `lookup_agent`, `check_agent_trust`, `get_trust_report`
- x402 payment flow (graceful 402 passthrough)
- Stdio transport
