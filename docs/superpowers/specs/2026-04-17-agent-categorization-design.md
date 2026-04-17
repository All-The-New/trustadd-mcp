# Agent Categorization System — Design Spec

**Date:** 2026-04-17  
**Status:** Proposed  
**Context:** Banner eyebrow text on agent profile pages currently shows `qualityTier` (HIGH/MEDIUM/LOW/UNCLASSIFIED), which is inaccurate (quality tier is stale, not re-evaluated after scoring) and not meaningful to humans. The intent is to show what type of agent this is — e.g. "DeFi & Trading" or "Personal Assistant".

---

## Problem

The agent profile banner eyebrow reads `UNCLASSIFIED · ACTIVE SINCE MAR 2026` for most agents, including well-known ones with scores > 30. This is because:

1. `qualityTier` is only computed once (at initial registration) and never re-evaluated after trust scoring runs
2. `qualityTier` is a quality proxy (high/medium/low based on trust score thresholds) — not a functional category
3. There is no stored per-agent functional category field in the database

The intent of the eyebrow is to tell humans *what the agent does* — its domain/purpose.

---

## Data Reality (as of 2026-04-17)

Queried from production (`agfyfdhvgekekliujoxc`):

| Signal | Coverage among score ≥ 15 agents (1,698 total) |
|---|---|
| Description ≥ 30 chars | **99.4%** (1,688 agents) |
| OASF domains populated | 1% (17 agents) |
| Tags populated | 3% (51 agents) |
| Capabilities populated | 1.7% (29 agents) |

**Key finding:** Description is the only reliable signal. OASF/tags/capabilities are too sparse today. Average description length for score ≥ 15 agents is 413 chars — rich enough for classification.

---

## Proposed Category Taxonomy (10 categories)

Derived from manually reviewing top agents in the index:

| Category Key | Display Label | Signal Keywords |
|---|---|---|
| `personal_assistant` | Personal Assistant | personal, assistant, life, secretary, help me, daily, schedule |
| `defi_trading` | DeFi & Trading | trading, trade, swap, defi, liquidity, dex, portfolio, position, RSI, EMA, hyperliquid, aave |
| `security_audit` | Security & Audit | security, audit, scan, threat, rug, exploit, vulnerability, firewall, forensic |
| `research_intel` | Research & Intel | research, news, alpha, analytics, intelligence, headlines, market, prediction, brief |
| `social_community` | Social & Community | social, community, farcaster, twitter, telegram, post, cast, engagement, followers |
| `developer_tools` | Developer Tools | deploy, contract, code, script, api, sdk, cli, devops, integration, solidity |
| `infrastructure` | Infrastructure | protocol, oracle, trust, identity, registry, infrastructure, layer, payments, x402 |
| `robotics_automation` | Robotics & Automation | robotics, automation, robot, manufacturing, physical, sensor, embedded, control systems |
| `gaming_entertainment` | Gaming & Entertainment | game, gaming, raffle, lottery, entertainment, fun, play, nft, collectible |
| `governance_dao` | Governance & DAO | dao, governance, vote, voting, council, multi-agent, deliberation, proposal |

Fallback: `general` → display "AI Agent"

---

## Classification Algorithm

**Input priority (highest to lowest):**

1. **OASF domains** — authoritative when present. Map domain strings to category keys via a lookup table. Confidence: `confirmed`.
2. **Description + name + tags** — keyword scoring per category. Each keyword hit adds weight; highest-scoring category wins if score > threshold. Confidence: `inferred`.
3. **Capabilities** — treated like tags. Secondary signal.
4. **No signal** → category: `general`, confidence: `none`.

**Scoring approach:**
- Primary keywords (strong signal): +3 points
- Secondary keywords (supporting): +1 point  
- Category wins if score ≥ 3 and leads second-place by ≥ 2 points
- Tie or ambiguous → `general` fallback

**Multi-category:** Agents can legitimately span categories (e.g. Clawnch is DeFi + Infrastructure). Store top-1 for eyebrow display, but store top-2 for future use.

---

## Accuracy Estimate

| Condition | Expected accuracy |
|---|---|
| OASF domains present | ~95% |
| Rich description (>100 chars) | ~80–85% |
| Short description (30–100 chars) | ~55–65% |
| Overall for score ≥ 15 | **~78–82%** |

Hard cases:
- Deliberately vague/poetic agents (e.g. Merkle: "cryptographic pet that lives in the terminal")
- Agents spanning multiple categories equally
- Agents with placeholder or template descriptions

---

## Schema Change

Add to `agents` table:

```sql
agent_category    text default 'general',
category_confidence  text default 'none',   -- 'confirmed' | 'inferred' | 'none'
category_evaluated_at  timestamptz,
```

No Postgres enum — keep as text for flexibility as taxonomy evolves.

---

## Implementation Plan (outline)

### Phase 1 — Classifier
- `server/agent-classifier.ts` — pure TypeScript function `classifyAgent(agent)` → `{ category, confidence, secondaryCategory? }`
- OASF domain → category lookup map
- Keyword scoring engine (name + description + tags + capabilities)
- Unit tests for all 10 categories + edge cases

### Phase 2 — Pipeline integration
- Add `agent_category`, `category_confidence`, `category_evaluated_at` columns via migration
- Add to daily `recalculate-scores` Trigger.dev task (runs after trust scoring)
- Also classify during initial agent registration in `indexer.ts`
- Re-classify existing agents via a one-time backfill script

### Phase 3 — Frontend
- Return `agentCategory` and `categoryConfidence` in `/api/agents/:id` response
- Update `banner.tsx` eyebrow: replace `qualityTier` with `agentCategory`
- Style: `confirmed` → full opacity label; `inferred` → slightly muted with optional tooltip "AI-inferred category"
- Fallback: if `general` or no category, show chain name only

---

## Open Questions

1. **Re-classification frequency** — should category be re-evaluated when description changes? Currently indexer updates description on metadata re-resolution; category should update then too.
2. **User correction** — long-term, should agents be able to self-declare category via OASF domains? (Yes — OASF domains already go into the DB; just need to read them in classifier)
3. **Multi-language descriptions** — some agent descriptions are non-English. Keyword matching degrades. Out of scope for v1.
4. **Display for spam/archived** — don't show category for spam-tier agents on public pages.

---

## Related Files

- `server/quality-classifier.ts` — existing quality tier classifier (parallel pattern)
- `server/storage/agents.ts:679` — `getAnalyticsCategories()` — existing SQL keyword matching (seed keyword lists from here)
- `shared/schema.ts` — agents table schema
- `trigger/recalculate.ts` — daily recalculation task to integrate with
- `client/src/pages/agent-profile/banner.tsx` — eyebrow display (Phase 3 target)
