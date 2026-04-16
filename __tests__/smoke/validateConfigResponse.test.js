import { describe, it, expect } from 'vitest';
import { validateConfigResponse } from '../../lib/guardrails.js';

describe('validateConfigResponse', () => {
  it('rejects {viable: "yes"} — viable must be a boolean', () => {
    const result = validateConfigResponse({ viable: 'yes' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('viable not boolean');
  });
});
