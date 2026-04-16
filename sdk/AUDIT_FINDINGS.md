# SSP Battery Configuration Tool — Audit Findings
# Source: Audit_4.16.26.md — copied verbatim. Do not paraphrase.
# Each finding gets STATUS: OPEN until closed by a sprint ticket.

---

## CRITICAL

### [C-1] Any authenticated user can permanently destroy the shared team library with a single PUT

**File:** pages/api/library.js:24-39

**Exploit:**
```
POST /api/library  (authenticated session cookie required)
Content-Type: application/json

{"library":{"cells":[],"bms_boards":[],"thermal":[],"connectors":[],"cases":[],"wiring":[],"design_rules":[]},"is_demo":false}
```
This atomically overwrites the singleton library row for every user on the team. Because the RLS policy on component_library is `FOR ALL ... USING (TRUE) WITH CHECK (TRUE)` (schema.sql:48), Postgres enforces no ownership check whatsoever. There is no audit trail, no backup, no soft-delete, no version history, no approval step.

**Impact:** Total loss of the shared component library for all users simultaneously.

**Fix:** Add an updated_by ownership gate, implement a version counter or previous_data JSONB backup column, restrict FOR ALL RLS policy to FOR INSERT only with explicit FOR UPDATE/DELETE policies with tighter USING predicate. Minimum viable: store the previous JSONB value in an audit column before every upsert.

**STATUS: CLOSED — TICKET-SSP-002, sha=d4729f8, 2026-04-16. Regression: __tests__/security/c1-library-rls.test.js. MERGED_PENDING_PLAYBOOK: run sdk/playbooks/TICKET-SSP-002.md in Supabase dashboard.**

---

### [C-2] Open self-registration with no domain restriction grants any person on the internet full access

**File:** pages/login.jsx:19-21, README.md:34-35

**Exploit:**
Navigate to https://[deployed-url]/login, click "Create one", enter any email (e.g. attacker@gmail.com), choose any password. Receive a Supabase confirmation email. Click the link. You are now an authenticated user with full read/write access to the shared library, all historical spec sheets, and the ability to execute C-1.

**Impact:** Competitor intelligence, library destruction (C-1), unlimited Anthropic API cost (H-1), access to proprietary configuration data for defense OEM prospects.

**Fix:** Supabase Auth supports email domain allowlisting via a custom hook or a before sign-up trigger. Add a Postgres function that rejects signups with email NOT LIKE '%@solidstatepower.com'. Alternatively, disable self-signup and use admin-invited-only flows.

**STATUS: CLOSED — TICKET-SSP-001, sha=0bd979a, 2026-04-16. Regression: __tests__/security/c2-open-registration.test.js. MERGED_PENDING_PLAYBOOK: run sdk/playbooks/TICKET-SSP-001.md in Supabase dashboard.**

---

### [C-3] margin_percent = 100 causes divide-by-zero producing Infinity as quoted price

**File:** pages/index.jsx:45

**Exploit:**
In Settings tab, set "Margin %" to 100. Click Save. Generate a configuration and spec sheet. `cogs / (1 - 100/100) = cogs / 0 = Infinity`. UI renders `$Infinity`. At margin_percent = 101, produces a negative number.

**Impact:** A quote showing $Infinity or a negative price is included on a spec sheet and emailed to an OEM. Contract-dispute surface and credibility event in front of a defense prime.

**Fix:** Clamp margin_percent server-side in settings.js to [0, 99] before storing. Add min="0" max="99" to the input. Guard calcCOGS: if 1 - margin_percent/100 <= 0, return null with a specific error.

**STATUS: CLOSED — TICKET-SSP-003, sha=79a3e1d, 2026-04-16. Regression: __tests__/security/c3-margin-clamp.test.js (10 cases). ACTIVE — no playbook required.**

---

## HIGH

### [H-1] No rate limiting or cost cap on Anthropic API routes

**File:** pages/api/configure.js:16-29, pages/api/specsheet.js:15-28

**Exploit:**
```bash
for i in $(seq 1 200); do
  curl -s -X POST https://[url]/api/configure \
    -H "Cookie: [session]" \
    -H "Content-Type: application/json" \
    -d '{...}' &
done
```
200 parallel requests × 4000 max tokens = 800,000 output tokens. No server-side throttle, no per-user counter, no concurrency limit.

**Impact:** Billing event against SSP's Anthropic API key.

**Fix:** Add in-memory or Redis-backed rate limit per session.user.id (e.g., 20 req/min). Set an Anthropic API spending limit in the console immediately.

**STATUS: OPEN**

---

### [H-2] /api/configure accepts client-supplied library without comparing to stored library

**File:** pages/api/configure.js:12, pages/index.jsx:152

**Exploit:**
```json
POST /api/configure (authenticated)
{
  "payload": { ... },
  "library": {
    "cells": [{"id": "CELL-FAKE", "nominal_voltage_v": 3.6, "capacity_ah": 999, ...}],
    ...
  }
}
```
Server sends fabricated library to the model. validateConfigResponse only checks structural shape, not whether cell IDs exist in real stored library.

**Impact:** Generated spec sheet for real OEM customer cites performance parameters for a fictitious component. False-claim liability.

**Fix:** In configure.js, fetch library from Supabase server-side and use stored version. Discard client-supplied library field entirely.

**STATUS: OPEN**

---

### [H-3] Prompt injection via application/company/product fields bypasses sanitizeText

**File:** pages/index.jsx:22-26

**Exploit:**
`sanitizeText` checks only 9 hardcoded strings client-side. Server (configure.js) receives payload fields with no sanitization. `configure.js:46` returns `res.json(parsed)` — any extra key the model adds (e.g., debug_system_prompt) is returned to the client.

**Impact:** System prompt exfiltration. Injection that defeats the banned-phrase filter produces a guardrail-violating spec sheet reaching a customer.

**Fix:** Server-side: sanitize all user-supplied string fields before embedding in model message. Return only whitelisted keys, not the raw parsed object.

**STATUS: OPEN**

---

### [H-4] History records rendered without re-running guardrail validation

**File:** pages/index.jsx:564, pages/api/history.js:22-34

**Exploit:**
```
POST /api/history (authenticated)
{"company":"HII","product":"Prototype X","vertical":"Defense","voltage":"12V","capacity_wh":164,
 "spec_content":{"product_name":"FAKE","fire_safety":"zero fire events — guaranteed",...}}
```
history.js performs no guardrail validation on spec_content before inserting. Record is stored and rendered by any team member who clicks it in History tab.

**Impact:** Team member views a History record containing banned/false claims, prints it, and sends to an OEM.

**Fix:** Run validateSpecSheet on spec_content before inserting in history.js. At render time, re-validate and show a warning banner if the stored record fails current guardrails.

**STATUS: OPEN**

---

### [H-5] pages/api/library.js GET uses .single() — error origin not distinguished

**File:** pages/api/library.js:11-19

**Exploit:**
If SUPABASE_URL or ANON_KEY is misconfigured, createServerClient throws synchronously before the route handler runs, producing an unhandled 500 with a Supabase error object that may leak the URL. Connectivity failure masquerades as "no library yet."

**Impact:** On a fresh deploy, app silently falls back to demo data without telling users why. Connectivity failure obscures real infrastructure errors.

**Fix:** Distinguish between "no row found" and "query failed" by inspecting error.code. Return `{ library: DEMO_LIBRARY, is_demo: true, warning: 'database unavailable' }` on genuine errors.

**STATUS: OPEN**

---

### [H-6] configurations table has no UPDATE or DELETE RLS policy — latent landmine

**File:** supabase/schema.sql:50-57

**Exploit:**
Missing FOR UPDATE and FOR DELETE policies. Currently safe (missing policy = DENY), but if app ever adds a "delete history" button calling `supabase.from('configurations').delete()` and a developer "fixes" the 403 by adding `USING (TRUE)`, anyone can delete everyone's history.

**Impact:** Currently safe but architecturally dangerous. Latent landmine for future developers.

**Fix:** Explicitly add FOR UPDATE and FOR DELETE policies with `USING (auth.uid() = user_id)`.

**STATUS: OPEN**

---

### [H-7] user_email displayed in HistoryTab but never selected in history GET query

**File:** pages/api/history.js:12, pages/index.jsx:549

**Exploit:**
history.js selects `user_id` (UUID), not `user_email`. `c.user_email` is undefined. Every history card shows "??" as the avatar. No user attribution visible.

**Impact:** Team cannot see who generated which spec sheet. Meaningful traceability gap for customer-facing outputs.

**Fix:** Store user_email explicitly in configurations table on insert (from session.user.email). Include it in the select().

**STATUS: OPEN**

---

## MEDIUM

### [M-1] sanitizeText is client-side only — security theater for server-side threat model

**File:** pages/index.jsx:22-26, pages/api/configure.js:12

**Impact:** Any injection bypassing the 9-word client blocklist reaches the model without server-side interception. Mislabeled as "sanitize."

**Fix:** Move injection checking to the server. Rename client function to `warnOnSuspiciousInput`.

**STATUS: OPEN**

---

### [M-2] calcCOGS silently passes cost_usd = 0 or negative values

**File:** pages/index.jsx:38, pages/index.jsx:44

**Impact:** Negative cost_usd in library produces a plausible-looking but incorrect quote. No UI warning.

**Fix:** In calcCOGS, validate cost_usd > 0 for both cell and BMS. Add library validation pass on import that flags non-positive costs.

**STATUS: OPEN**

---

### [M-3] BANNED_RE misses multiple semantically equivalent Wh/kg expressions

**File:** lib/guardrails.js:6

**Exploit misses:** "401 watt-hours per kilogram", "401 Wh per kg", "ten C rate" (no digit adjacent to C), "specific energy 401 Wh kg⁻¹" (Unicode superscript).

**Impact:** Model produces semantically equivalent Wh/kg claim in customer spec sheet. Guardrail passes. Spec sheet sent to HII.

**Fix:** Replace/augment BANNED_RE[0] with broader pattern covering `watt.?hours?\s*per\s*kilo` and per kg form.

**STATUS: OPEN**

---

### [M-4] validateConfigResponse rejects bms_g: 0 — BMS-less configs permanently invalid

**File:** lib/guardrails.js:71

**Exploit:** `if (!wb.bms_g || wb.bms_g <= 0)` rejects zero. BMS-less or negligible-weight configs produce opaque 422 error with no recovery.

**Fix:** Change check to `wb.bms_g === undefined || wb.bms_g === null` to allow zero values.

**STATUS: OPEN**

---

### [M-5] Notes dimension-check passes with strings containing keywords but no arithmetic

**File:** lib/guardrails.js:73-75

**Exploit:** Model returns `notes: "The cell length, width, and depth are within the enclosure boundaries."` — contains all three substrings, passes validation with zero arithmetic.

**Fix:** Require notes contain a numeric expression pattern adjacent to keywords, or validate margin arithmetic server-side directly from margin fields.

**STATUS: OPEN**

---

### [M-6] History search concatenates fields without null guards

**File:** pages/index.jsx:536

**Impact:** Searching "null" returns all records with null company/product/vertical. Unexpected behavior.

**Fix:** Use `(c.company||'')+(c.product||'')+(c.vertical||'')`.

**STATUS: OPEN**

---

### [M-7] Every single-cell edit triggers a full library PUT — last write wins on slow connections

**File:** pages/index.jsx:406-410

**Impact:** On slow connections, rapid edits lose data silently. Toast says "Library saved" even when a prior write was clobbered.

**Fix:** Debounce saveLibrary with 500ms delay. Or add a "Save" button per section rather than auto-saving on every cell blur.

**STATUS: OPEN**

---

### [M-8] deleteRow uses window.confirm with no undo

**File:** pages/index.jsx:420-425

**Impact:** A mis-click permanently deletes a library component row with no recovery path.

**Fix:** Replace confirm() with an in-app confirmation modal. Implement soft-delete with 10-second undo toast.

**STATUS: OPEN**

---

### [M-9] settings.js upsert return value not checked — silent failure possible

**File:** pages/api/settings.js:21

**Impact:** Settings save failures silently swallowed. User sees "Settings saved" even when save failed. Settings revert on next page load without explanation.

**Fix:** Destructure `{ error }` from upsert and return 500 if present.

**STATUS: OPEN**

---

### [M-10] createAdminClient is dead code with a dangerous key reference

**File:** lib/supabase.js:16-21

**Impact:** Dead code. If ever accidentally called from a route, service role key bypasses all RLS. Presence in lib/ increases attack surface.

**Fix:** Delete createAdminClient entirely.

**STATUS: OPEN**

---

## LOW

### [L-1] quoteMarginkUsed is a typo for quoteMarginUsed — no functional impact

**File:** pages/index.jsx:115, 126, 171, 181

**Fix:** Rename to `quoteMarginUsed` throughout.

**STATUS: OPEN**

---

### [L-2] parseWorkbook silently falls back to existing library data when a sheet is missing

**File:** pages/index.jsx:398-403

**Impact:** Success toast shows counts from previous library, not imported file. User believes import is complete when it is partial.

**Fix:** Track which sheets were found/missing and warn explicitly when a section falls back to existing data.

**STATUS: OPEN**

---

### [L-3] xlsx package pinned to ^0.18.5 — CVE-2023-30533 prototype pollution

**File:** package.json:15

**Impact:** Maliciously crafted .xlsx uploaded by any authenticated user could corrupt the Node.js process object.

**Fix:** Pin to xlsx@0.20.x or migrate to exceljs.

**STATUS: OPEN**

---

### [L-4] Loading state renders before middleware redirect — brief flash to unauthenticated users

**File:** pages/index.jsx:621

**Impact:** Cosmetic. No data exposure.

**Fix:** No urgent action. Could use getServerSideProps with session check.

**STATUS: OPEN**

---

### [L-5] @supabase/auth-helpers-nextjs@^0.10.0 is deprecated — successor is @supabase/ssr

**File:** package.json:13, lib/supabase.js:2-3

**Impact:** No current functional breakage. Future Supabase/Next.js changes may silently break session handling.

**Fix:** Migrate to @supabase/ssr per Supabase migration guide.

**STATUS: OPEN**
