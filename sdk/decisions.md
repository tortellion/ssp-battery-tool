# SSP Decisions Log — append-only
# Format: DEC-NNN — <title>, <date>, <commit SHA or "pre-commit">, <decision text>

---

DEC-002 — Sprint 1 close, 2026-04-16, sha=dcf0617
Closed C-1, C-2, C-3. SSP-003 (C-3) fully active. SSP-001 (C-2) and SSP-002 (C-1) are MERGED_PENDING_PLAYBOOK — enforcement requires running SQL migrations in Supabase dashboard. Test floor raised 3→22. RLS update policy uses updated_by ownership gate (not USING TRUE). Decision: allow any authenticated user to UPDATE if updated_by IS NULL (first write after fresh deploy) — acceptable because C-2 allowlist closes the open-registration attack surface first.

DEC-001 — Sprint 0 bootstrap, 2026-04-16, pre-commit
Established sdk/ scaffold, Vitest ratchet floor=3, copied audit findings verbatim. npm install required before bootstrap (no node_modules present). Build fails without .env.local — resolved by creating from .env.local.example. 25 findings across 3C/7H/10M/5L, all STATUS: OPEN. Sprint 1 planned: C-1+C-2+C-3 ship together per harness hard-code.
