import { createClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

// Browser client — used in React components
export function createBrowserClient() {
  return createBrowserSupabaseClient();
}

// Server client — used in API routes (requires req, res)
export function createServerClient(req, res) {
  return createServerSupabaseClient({ req, res });
}

// Admin client for migrations/schema (uses service role — never expose to browser)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
