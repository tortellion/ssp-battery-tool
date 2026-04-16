import { createBrowserClient as ssrBrowser } from '@supabase/ssr';
import { createServerClient as ssrServer } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Browser client — used in React components
export function createBrowserClient() {
  return ssrBrowser(url, anon);
}

// Server client — used in API routes (requires req, res)
export function createServerClient(req, res) {
  return ssrServer(url, anon, {
    cookies: {
      getAll() {
        return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${options?.maxAge ? `; Max-Age=${options.maxAge}` : ''}`);
        });
      },
    },
  });
}
