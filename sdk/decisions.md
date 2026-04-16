# SSP Decisions Log — append-only
# Format: DEC-NNN — <title>, <date>, <commit SHA or "pre-commit">, <decision text>

---

DEC-003 — Sprint 2 close, 2026-04-16, sha=d30d0f2
Closed H-1/H-2/H-3/H-4/H-7 + M-1/M-3/M-4/M-9/M-10/L-1 (11 findings). All fixes code-only except H-7 which requires a DB migration adding user_email column to configurations table. H-1 rate limiter is in-memory (per-instance) — acceptable for current single-instance deployment; Upstash Redis upgrade path documented. Decision: H-3 output whitelist returns only the 3 schema-defined keys; any extra model output is silently dropped rather than errored — chosen to be non-breaking for the client. Test floor raised 22→57. Rolling velocity 13→15.5 pts/sprint (2-sprint window).

DEC-002 — Sprint 1 close, 2026-04-16, sha=dcf0617
Closed C-1, C-2, C-3. SSP-003 (C-3) fully active. SSP-001 (C-2) and SSP-002 (C-1) are MERGED_PENDING_PLAYBOOK — enforcement requires running SQL migrations in Supabase dashboard. Test floor raised 3→22. RLS update policy uses updated_by ownership gate (not USING TRUE). Decision: allow any authenticated user to UPDATE if updated_by IS NULL (first write after fresh deploy) — acceptable because C-2 allowlist closes the open-registration attack surface first.

DEC-001 — Sprint 0 bootstrap, 2026-04-16, pre-commit
Established sdk/ scaffold, Vitest ratchet floor=3, copied audit findings verbatim. npm install required before bootstrap (no node_modules present). Build fails without .env.local — resolved by creating from .env.local.example. 25 findings across 3C/7H/10M/5L, all STATUS: OPEN. Sprint 1 planned: C-1+C-2+C-3 ship together per harness hard-code.
