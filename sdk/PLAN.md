# SSP Battery Configuration Tool — Remediation Plan

## Phase S1 — Criticals (Sprint 1)
C-1 + C-2 + C-3 ship together.
- C-1 without C-2 leaves new self-registrants in the attacker pool.
- C-2 without C-1 leaves the library nukable by current staff.
- C-3 is a commercial liability on every quote until closed.

Tickets: TICKET-SSP-001 (C-2 email allowlist), TICKET-SSP-002 (C-1 RLS + audit column), TICKET-SSP-003 (C-3 margin clamp), TICKET-SSP-004 (regression tests).

## Phase S2 — Exploitable Highs (Sprint 2)
H-1 (Anthropic rate limiting), H-2 (server-side library fetch in configure.js), H-3 (server-side prompt sanitization + output whitelist), H-4 (guardrail validation on history insert + render).

## Phase S3 — Remaining Highs + Mediums (Sprint 3)
H-5 (library.js error distinction), H-6 (explicit UPDATE/DELETE RLS), H-7 (user_email in history).
M-1 through M-10 triaged by impact: M-9 (silent settings failure), M-3 (BANNED_RE gaps), M-4 (bms_g zero), M-10 (dead createAdminClient), M-2 (negative cost_usd), M-5 (dimension arithmetic), M-6 (null guard), M-7 (debounce saves), M-8 (delete modal).

## Phase S4 — Lows + Hardening (Sprint 4)
L-1 (typo), L-2 (import fallback warning), L-3 (xlsx CVE upgrade), L-4 (loading flash), L-5 (migrate to @supabase/ssr).
Appendix hardening: CSP headers, structured logging, Next.js upgrade, npm audit fixes.
