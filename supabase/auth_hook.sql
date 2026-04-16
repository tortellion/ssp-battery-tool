-- SSP Auth Hook — Email Domain Allowlist
-- Closes C-2: blocks self-registration from non-SSP email addresses.
--
-- SETUP (run once in Supabase Dashboard → SQL Editor):
--   1. Run this entire file.
--   2. Go to Authentication → Hooks → "Custom Access Token Hook" is NOT what we need.
--      Instead: Authentication → Hooks → "Before sign-up hook" (if available on your plan),
--      OR use the approach below: a trigger on auth.users that immediately deletes
--      and raises an error for disallowed domains.
--
-- IMPORTANT: Supabase's "before sign-up" hook (via Edge Function) is available on Pro plans.
-- For free-tier projects, use the trigger approach below which fires immediately after
-- the INSERT to auth.users and raises an exception, rolling back the transaction.
--
-- ALLOWED DOMAINS: edit the array below to add/remove permitted domains.

-- ── Step 1: Create the validation function ────────────────────────────────
CREATE OR REPLACE FUNCTION auth.check_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  allowed_domains TEXT[] := ARRAY[
    '@solidstatepower.com',
    '@solidstatemarine.com'
  ];
  email_domain TEXT;
  is_allowed BOOLEAN := FALSE;
  d TEXT;
BEGIN
  -- Extract the email from the new auth.users row
  email_domain := substring(NEW.email FROM '@.*$');

  FOREACH d IN ARRAY allowed_domains LOOP
    IF lower(email_domain) = lower(d) THEN
      is_allowed := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF NOT is_allowed THEN
    RAISE EXCEPTION 'unauthorized: email domain not permitted for registration'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ── Step 2: Attach the trigger to auth.users ──────────────────────────────
DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;

CREATE TRIGGER enforce_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.check_email_domain();

-- ── Step 3: Verify (run and confirm no non-SSP users exist) ───────────────
-- SELECT email FROM auth.users
--   WHERE email NOT LIKE '%@solidstatepower.com'
--   AND email NOT LIKE '%@solidstatemarine.com';
-- Expected: 0 rows (or rows you intentionally allow — clean up before enforcing).
