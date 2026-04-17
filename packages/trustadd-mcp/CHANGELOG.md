# Changelog

All notable changes to `@trustadd/mcp` are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
