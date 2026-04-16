# SSP Architect Onboarding

## Stage 1 — Mandatory reads (in order)
| # | File | Takeaway required |
|---|------|-------------------|
| 1 | sdk/AUDIT_FINDINGS.md | Name C-1, C-2, C-3 from memory |
| 2 | sdk/PLAN.md | Which phase is current sprint in |
| 3 | sdk/sprint.json | Current sprint number + status |
| 4 | sdk/board.json | Which tickets are IN_PROGRESS / READY |
| 5 | sdk/platform_state.json | Test count floor; flag if actual < floor |
| 6 | pages/index.jsx (652 lines) | Which tab contains margin_percent input (C-3) |
| 7 | lib/guardrails.js (90 lines) | Count of entries in BANNED, REQUIRED_PROOFS_NM |
| 8 | supabase/schema.sql (62 lines) | Which RLS policy uses USING (TRUE) (C-1) |
| 9 | pages/api/library.js (43 lines) | Which line is the upsert |
| 10 | pages/login.jsx (87 lines) | Whether signup has any domain restriction |

## Stage 2 — Verification questions (answer each with file:line before writing any ticket)

1. What exact string in supabase/schema.sql makes C-1 exploitable? Quote verbatim with line number.
2. How many entries in BANNED in lib/guardrails.js? Count.
3. Which line in pages/index.jsx computes the quote from margin_percent? What happens at margin_percent = 100?
4. What regex does middleware.js match? Does api/library match? Quote the regex.
5. What JSON keys does the Anthropic response get parsed into at pages/api/configure.js:39? Whitelisted before return?
6. Any test file in the repo? If yes where, if no what does Sprint 0 add?
7. Current value of sdk/platform_state.json testCounts.floor? Does your planned work drop below it?
8. Does your ticket mention any symbol not in `grep -r` of the codebase?
9. Finding closed? Which one? Quote the trigger text verbatim.
10. Protected scope (all three tests)? Have you Todd's "approved" on this specific diff SHA?

## Stage 3 — Anti-theatrical checks
- P1 — Phantom files: every ticket ID in non-BACKLOG lanes has a file in sdk/tasks/
- P2 — Fabricated numbers: every number traces to a pasted command output in this session
- P3 — Wrong-codebase symbols: every function/table/column/policy/route/regex grep-confirmed in ssp-app
- P4 — Dead or banned strings: every new string literal grep'd against lib/guardrails.js BANNED + BANNED_RE
- P5 — Theatrical decisions: decisions.md entries include commit SHA or branch. DEFERRED entries include target_date and next_action.

## Stage 4 — Halt conditions
1. Test count drops below floor in platform_state.json (DEC-038 drift)
2. npm run build returns any error at any point
3. Audit cites code that doesn't match current codebase
4. Protected-scope change without fresh "approved" on this specific diff SHA
5. Ticket would require USING (TRUE) on an RLS policy
6. Ticket would modify lib/guardrails.js BANNED list without grep evidence
7. Any onboarding Stage 2 question answerable without a file:line reference
8. Context under 40k tokens at start of a new ticket → handoff
9. Finding marked CLOSED but adversarial reproduction still succeeds
10. Tempted to write a DEC entry that says "documented — deferred" → halt, write the repair
11. Any AUDITOR test-count mismatch with BUILDER (E1/E4 violation)
12. Second evidence mismatch in same session → session invalidated
