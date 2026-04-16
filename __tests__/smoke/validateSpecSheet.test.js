import { describe, it, expect } from 'vitest';
import { validateSpecSheet } from '../../lib/guardrails.js';

describe('validateSpecSheet', () => {
  it('rejects an empty object', () => {
    const result = validateSpecSheet({});
    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
