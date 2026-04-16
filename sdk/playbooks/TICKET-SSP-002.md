# Playbook: TICKET-SSP-002 — RLS ownership + audit column activation
# Status: MERGED_PENDING_PLAYBOOK — run these steps in Supabase to activate.

## What this does
1. Adds a `previous_data JSONB` column to `component_library` (audit trail).
2. Drops the `FOR ALL USING (TRUE)` policy that let any user wipe the library.
3. Replaces it with:
   - FOR INSERT: any authenticated user (creates the first singleton row)
   - FOR UPDATE: only the user who last wrote (`updated_by = auth.uid()`) OR if no prior writer

## Step 1 — Apply the schema migration

In Supabase Dashboard → SQL Editor → New query, run:

```sql
-- Add audit column
ALTER TABLE component_library ADD COLUMN IF NOT EXISTS previous_data JSONB;

-- Drop the exploit policy
DROP POLICY IF EXISTS "Authenticated users can upsert library" ON component_library;

-- Add scoped INSERT policy
CREATE POLICY "Authenticated users can insert library"
  ON component_library FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Add ownership-gated UPDATE policy
CREATE POLICY "Library writer can update library"
  ON component_library FOR UPDATE
  TO authenticated
  USING (updated_by IS NULL OR updated_by = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL);
```

## Step 2 — Verify policies

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'component_library';
```

Expected: 3 rows — SELECT (read), INSERT (insert), UPDATE (ownership-gated).
Must NOT see: any policy with cmd='ALL' or qual='true' on component_library.

## Step 3 — Verify audit column exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'component_library';
```
Expected: includes `previous_data` with type `jsonb`.

## Step 4 — Adversarial test (confirm wipe is blocked)

As a second authenticated user (or with a second browser session), attempt:
```bash
curl -s -X PUT https://[deployed-url]/api/library \
  -H "Content-Type: application/json" \
  -H "Cookie: [second-user-session]" \
  -d '{"library":{"cells":[],"bms_boards":[]},"is_demo":false}'
```
Expected: 500 response with an RLS error — the second user cannot overwrite
a library that was last written by a different user.

## Step 5 — Confirm the original writer can still save

The user who last saved the library (updated_by = their UUID) can PUT normally.
Confirm via the UI: open the Library tab, edit a cell cost, verify "Library saved" toast.

## Step 6 — Confirm previous_data is populated after a save

```sql
SELECT updated_by, updated_at,
       jsonb_array_length(data->'cells') as current_cells,
       jsonb_array_length(previous_data->'cells') as previous_cells
FROM component_library;
```
After a save: `previous_data` should contain the pre-save state (not null after
the second write). First write sets previous_data to null (no prior state).

## Rollback (emergency only)

```sql
DROP POLICY IF EXISTS "Authenticated users can insert library" ON component_library;
DROP POLICY IF EXISTS "Library writer can update library" ON component_library;
CREATE POLICY "Authenticated users can upsert library"
  ON component_library FOR ALL
  TO authenticated USING (TRUE) WITH CHECK (TRUE);
```
WARNING: This re-opens C-1. Only use in a break-glass scenario.
