import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// C-1: Any authenticated user can wipe the shared component library.
// Root cause: schema.sql line 47-48 uses FOR ALL ... USING (TRUE) WITH CHECK (TRUE).
// These tests assert structural properties of the schema that TICKET-SSP-002 must fix.
// They will FAIL (correctly) until SSP-002 is merged and schema.sql is patched.

const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');

describe('C-1 — component_library RLS policy regression', () => {
  it('schema must NOT contain FOR ALL on component_library with USING (TRUE) — the exploit policy', () => {
    // This pattern is the exact text that makes C-1 exploitable.
    // After TICKET-SSP-002, this policy must be replaced with scoped INSERT/UPDATE/DELETE policies.
    const exploitPattern = /ON component_library FOR ALL[\s\S]*?USING\s*\(TRUE\)/;
    expect(schema).not.toMatch(exploitPattern);
  });

  it('schema must NOT contain WITH CHECK (TRUE) on component_library', () => {
    // WITH CHECK (TRUE) means any authenticated user can write any value — no ownership check.
    const lines = schema.split('\n');
    const libPolicyBlock = lines
      .slice(lines.findIndex(l => l.includes('component_library FOR ALL')))
      .slice(0, 5)
      .join('\n');
    expect(libPolicyBlock).not.toMatch(/WITH CHECK \(TRUE\)/);
  });

  it('schema must have a FOR INSERT policy on component_library', () => {
    expect(schema).toMatch(/ON component_library FOR INSERT/);
  });

  it('schema must have a FOR UPDATE policy on component_library with ownership check', () => {
    // After the fix, only the last writer (or admin) should be able to overwrite.
    expect(schema).toMatch(/ON component_library FOR UPDATE/);
    // The UPDATE policy must NOT use USING (TRUE) — must reference updated_by or auth.uid()
    const updateBlock = schema.match(/ON component_library FOR UPDATE[\s\S]*?;/)?.[0] || '';
    expect(updateBlock).not.toMatch(/USING\s*\(TRUE\)/);
  });

  it('schema must have an audit/previous_data column OR version column on component_library', () => {
    // Minimum viable fix from the audit: store previous JSONB before every upsert.
    const hasAuditCol = /previous_data\s+JSONB|version\s+INTEGER|version_counter/.test(schema);
    expect(hasAuditCol).toBe(true);
  });
});
