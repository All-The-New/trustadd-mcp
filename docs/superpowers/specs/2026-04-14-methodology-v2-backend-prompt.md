---
name: Methodology v2 backend implementation — next session kickoff
description: Self-contained prompt to resume the backend rewrite for Methodology v2
created: 2026-04-14
---

# Kickoff Prompt (paste as first message next session)

> Implement the Methodology v2 backend rewrite. The full refined plan is in `~/.claude/projects/-Users-ethserver-CLAUDE-trustadd/memory/project_next_tasks.md` (task #0), audited 2026-04-14 against the live `/methodology` page. Spec is at `docs/superpowers/specs/2026-04-13-methodology-v2-design.md`. Source of truth for category names, signal lists, and the 9 Verifications is `client/src/lib/content-zones.ts` (METHODOLOGY export) and `client/src/pages/methodology.tsx` (VERIFICATIONS array).
>
> **Scope this session: backend only.** Frontend v2 integrations are a separate session.
>
> Follow the sequencing in the plan:
> 1. Interfaces + storage prefetchers (`TxStats`, `AttestationStats`, `ProbeStats`) — let compile errors guide the rewrite
> 2. Rewrite `server/trust-score.ts` for the 5 categories (Transactions 35 / Reputation 25 / Profile 15 / Longevity 15 / Community 10) and 21 signals
> 3. Add `server/trust-verifications.ts` — pure function emitting the 9 verification badges
> 4. Update `server/trust-report-compiler.ts` — new 6-tier `Verdict` (FLAGGED/UNVERIFIED/INSUFFICIENT_DATA/BUILDING/TRUSTED/VERIFIED), `evidenceBasis` field, two-layer report shape (`trustRating` + `verifications`)
> 5. Bump `METHODOLOGY_VERSION` to 2 in `server/trust-provenance.ts`; extend `CanonicalSignals` with behavioral fields
> 6. Update `server/trust-confidence.ts` — add `hasAttestations` source, rebalance weights to total 1.0
> 7. Rewrite tests: `__tests__/trust-score.test.ts`, `__tests__/verdict-logic.test.ts`, `__tests__/confidence.test.ts`, new `__tests__/verifications.test.ts`; update `__tests__/fixtures/agents.ts` with new stat fixtures
> 8. Run `npm test` until clean, `tsc --noEmit` clean
> 9. Stop before recalculate/deploy — user will review
>
> **Guardrails**
> - Centralize all thresholds/weights as named constants for easy recalibration (calibration philosophy from the audit)
> - Use "Verifications" not "Badges" in any user-facing strings or API field names
> - FLAGGED requires active negative evidence (`flags.spam || flags.archived || (spamFlags.length > 0 && score < 10)`) — never just low score
> - Keep `signal.name` strings stable with the content-zones.ts labels so frontend renders match
> - Dynamic `import()` inside any Trigger.dev task `run` functions that touch the new types (per CLAUDE.md)
>
> Begin by reading `project_next_tasks.md` task #0 in full, then the current `server/trust-score.ts` and `server/trust-report-compiler.ts`. Ask clarifying questions only if the plan is genuinely ambiguous.
