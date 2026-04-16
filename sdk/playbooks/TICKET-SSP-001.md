# Playbook: TICKET-SSP-001 — Email domain allowlist activation
# Status: MERGED_PENDING_PLAYBOOK — run these steps to activate the fix in Supabase.

## What this does
Installs a BEFORE INSERT trigger on auth.users that raises an exception for any
email not ending in @solidstatepower.com or @solidstatemarine.com.
Self-registration attempts from other domains receive an error and the account
is NOT created.

## Step 1 — Check existing users (run BEFORE activating the trigger)

In Supabase Dashboard → SQL Editor → New query:

```sql
SELECT email, created_at
FROM auth.users
WHERE email NOT LIKE '%@solidstatepower.com'
  AND email NOT LIKE '%@solidstatemarine.com'
ORDER BY created_at;
```

If any rows appear: these are non-SSP accounts already registered.
Action: manually delete them via the Supabase Auth dashboard (Authentication → Users)
or confirm they are authorized (e.g., a test account you own).
Do NOT activate the trigger until this query returns 0 rows you did not intend to allow.

## Step 2 — Apply the migration

In Supabase Dashboard → SQL Editor → New query:
Paste the full contents of supabase/auth_hook.sql and run.

Expected output: no errors. "DROP TRIGGER" and "CREATE TRIGGER" succeed.

## Step 3 — Verify trigger is installed

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'enforce_email_domain';
```
Expected: 1 row — enforce_email_domain / INSERT / users

## Step 4 — Adversarial test (confirm rejection)

Attempt to create an account at [deployed-url]/login with attacker@gmail.com.
Expected: Supabase returns an error, no confirmation email is sent, no account created.

Confirm via:
```sql
SELECT email FROM auth.users WHERE email = 'attacker@gmail.com';
```
Expected: 0 rows.

## Step 5 — Confirm SSP staff can still register

Attempt to create an account with a @solidstatepower.com or @solidstatemarine.com email.
Expected: confirmation email sent, account created normally.

## To add a new allowed domain in future

Edit supabase/auth_hook.sql, add the domain to the allowed_domains array, and re-run
Steps 2–4. The function is replaced (CREATE OR REPLACE), trigger stays in place.

## Rollback

To disable the allowlist (emergency only):
```sql
DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;
```
This leaves the function in place but stops enforcement.
