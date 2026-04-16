import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateConfigResponse } from '../../lib/guardrails';

const guardrailsSrc = readFileSync(resolve('lib/guardrails.js'), 'utf8');
const supabaseSrc   = readFileSync(resolve('lib/supabase.js'), 'utf8');
const indexSrc      = readFileSync(resolve('pages/index.jsx'), 'utf8');

// M-1: client fn renamed to warnOnSuspiciousInput
test('index.jsx uses warnOnSuspiciousInput not sanitizeText', () => {
  expect(indexSrc).toMatch(/warnOnSuspiciousInput/);
  expect(indexSrc).not.toMatch(/function sanitizeText/);
});

// M-3: broader Wh/kg regex catches prose forms
test('BANNED_RE source covers wh/kg and prose forms', () => {
  expect(guardrailsSrc).toMatch(/watt.*hours/i);
  expect(guardrailsSrc).toMatch(/per.*kilo/i);
});

test('BANNED_RE catches "401 watt-hours per kilogram" prose form', () => {
  // Inline the updated regex to verify it works
  const re = /\d[\d,.]*\s*(wh\/?kg|watt.?hours?\s+per\s+kilo)/i;
  expect(re.test('401 Wh/kg')).toBe(true);
  expect(re.test('401 watt-hours per kilogram')).toBe(true);
  expect(re.test('350 watt hours per kilo')).toBe(true);
  expect(re.test('no energy density here')).toBe(false);
});

// M-4: bms_g === 0 is now valid
test('validateConfigResponse accepts bms_g of 0', () => {
  const minimal = {
    viable: true,
    configurations: [{
      series_count: 4, parallel_count: 1, total_cells: 4,
      fits: true,
      margin_length_mm: 5, margin_width_mm: 5, margin_depth_mm: 5,
      weight_breakdown: { bms_g: 0, thermal_g: 50 },
      notes: 'length=247mm width=112mm depth=16mm all within enclosure',
    }],
  };
  const result = validateConfigResponse(minimal);
  expect(result.errors).not.toContain(expect.stringMatching(/bms_g must be >0/));
});

test('validateConfigResponse still rejects missing bms_g', () => {
  const minimal = {
    viable: true,
    configurations: [{
      series_count: 4, parallel_count: 1, total_cells: 4,
      fits: true,
      margin_length_mm: 5, margin_width_mm: 5, margin_depth_mm: 5,
      weight_breakdown: { thermal_g: 50 },
      notes: 'length=247mm width=112mm depth=16mm all within enclosure',
    }],
  };
  const result = validateConfigResponse(minimal);
  expect(result.errors.some(e => e.includes('bms_g'))).toBe(true);
});

// M-10: createAdminClient dead code removed
test('supabase.js does not export createAdminClient', () => {
  expect(supabaseSrc).not.toMatch(/createAdminClient/);
});

test('supabase.js does not import @supabase/supabase-js directly', () => {
  expect(supabaseSrc).not.toMatch(/from '@supabase\/supabase-js'/);
});

// L-1: typo fixed
test('index.jsx uses quoteMarginUsed not quoteMarginkUsed', () => {
  expect(indexSrc).not.toMatch(/quoteMarginkUsed/);
  expect(indexSrc).toMatch(/quoteMarginUsed/);
});
