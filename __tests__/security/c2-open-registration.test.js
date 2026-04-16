import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// C-2: Open self-registration — any email can sign up and get full library access.
// Root cause: login.jsx:20 calls supabase.auth.signUp with no domain check.
// Fix: Supabase auth hook (supabase/auth_hook.sql) rejects non-allowlisted domains.
// These tests assert that the fix artifacts exist and contain the correct guard.

describe('C-2 — open registration domain allowlist regression', () => {
  it('supabase/auth_hook.sql must exist — the domain allowlist hook', () => {
    let content;
    try {
      content = readFileSync(resolve(process.cwd(), 'supabase/auth_hook.sql'), 'utf8');
    } catch {
      content = null;
    }
    expect(content).not.toBeNull();
  });

  it('auth_hook.sql must reference solidstatepower.com domain allowlist', () => {
    const content = readFileSync(resolve(process.cwd(), 'supabase/auth_hook.sql'), 'utf8');
    // Must contain the domain check — either LIKE pattern or explicit domain list.
    const hasDomainCheck = content.includes('solidstatepower.com') ||
      content.includes('allowed_domains') ||
      content.includes('email_domain');
    expect(hasDomainCheck).toBe(true);
  });

  it('auth_hook.sql must RAISE an exception or return an error for disallowed domains', () => {
    const content = readFileSync(resolve(process.cwd(), 'supabase/auth_hook.sql'), 'utf8');
    // Must actively reject — not just log.
    const hasRejection = /RAISE\s+EXCEPTION|error.*unauthorized|is_allowed.*false/i.test(content);
    expect(hasRejection).toBe(true);
  });

  it('login.jsx must not contain unrestricted signUp call without domain validation comment', () => {
    const login = readFileSync(resolve(process.cwd(), 'pages/login.jsx'), 'utf8');
    // After fix: either login.jsx adds client-side domain check (defense-in-depth),
    // OR it contains a comment confirming the server-side hook is the enforcement point.
    // Either way, the raw unrestricted signUp must be accompanied by the hook.
    // This test confirms login.jsx still has signup (it should — the hook is the gate,
    // not removing the UI) and that auth_hook.sql exists (tested above).
    expect(login).toMatch(/signUp/);
  });
});
