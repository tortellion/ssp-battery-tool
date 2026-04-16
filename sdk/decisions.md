# SSP Decisions Log — append-only
# Format: DEC-NNN — <title>, <date>, <commit SHA or "pre-commit">, <decision text>

---

DEC-001 — Sprint 0 bootstrap, 2026-04-16, pre-commit
Established sdk/ scaffold, Vitest ratchet floor=3, copied audit findings verbatim. npm install required before bootstrap (no node_modules present). Build fails without .env.local — resolved by creating from .env.local.example. 25 findings across 3C/7H/10M/5L, all STATUS: OPEN. Sprint 1 planned: C-1+C-2+C-3 ship together per harness hard-code.
