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
