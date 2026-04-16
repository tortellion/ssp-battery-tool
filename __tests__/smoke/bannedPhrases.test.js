import { describe, it, expect } from 'vitest';
import { validateSpecSheet } from '../../lib/guardrails.js';

describe('BANNED phrase enforcement', () => {
  it('BANNED is a non-empty array (sanity — if this fails, guardrails.js was emptied)', () => {
    // We reach into the module indirectly: a spec with a known banned phrase must fail.
    // "zero fire events" is in BANNED (guardrails.js:2).
    const result = validateSpecSheet({
      proof_points: [
        '2+ years of continuous deployment in marine environments',
        '6 MW shipped in 2025 across 30+ production SKUs',
        'Customers include Huntington Ingalls Industries, HAVOCAI, and VATN',
        'IBEX 2025 Innovation Award (NMMA)',
      ],
      comparison_rows: [
        { metric: 'WEIGHT',      ssp_claim: 'x', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
        { metric: 'SIZE',        ssp_claim: 'x', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
        { metric: 'DISCHARGE',   ssp_claim: 'x', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
        { metric: 'CHARGE',      ssp_claim: 'x', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
        { metric: 'TEMPERATURE', ssp_claim: 'x', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
        { metric: 'FIRE SAFETY', ssp_claim: 'zero fire events — guaranteed', ssp_application: 'x', lfp_baseline: 'x', lfp_consequence: 'x', improvement: 'x' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.phrase === 'zero fire events')).toBe(true);
  });
});
