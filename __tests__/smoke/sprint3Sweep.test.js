import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateConfigResponse } from '../../lib/guardrails';

const indexSrc = readFileSync(resolve('pages/index.jsx'), 'utf8');

// ── M-2: cost_usd > 0 guard in calcCOGS ─────────────────────────────────────

test('calcCOGS guards against cost_usd <= 0 for cell', () => {
  expect(indexSrc).toMatch(/cell\.cost_usd<=0/);
});

test('calcCOGS guards against cost_usd <= 0 for bms', () => {
  expect(indexSrc).toMatch(/bms\.cost_usd<=0/);
});

// ── M-5: numeric dimension check ────────────────────────────────────────────

test('validateConfigResponse rejects notes with dimension keywords but no numbers', () => {
  const cfg = {
    viable: true,
    configurations: [{
      series_count: 4, parallel_count: 1, total_cells: 4,
      fits: true,
      margin_length_mm: 5, margin_width_mm: 5, margin_depth_mm: 5,
      weight_breakdown: { bms_g: 10, thermal_g: 50 },
      notes: 'the length, width, and depth are within enclosure boundaries.',
    }],
  };
  const result = validateConfigResponse(cfg);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => e.includes('dimension'))).toBe(true);
});

test('validateConfigResponse accepts notes with numeric dimension values', () => {
  const cfg = {
    viable: true,
    configurations: [{
      series_count: 4, parallel_count: 1, total_cells: 4,
      fits: true,
      margin_length_mm: 5, margin_width_mm: 5, margin_depth_mm: 5,
      weight_breakdown: { bms_g: 10, thermal_g: 50 },
      notes: 'length=247mm width=112mm depth=16mm all within enclosure. margin length 18mm, width 13mm, depth 12mm.',
    }],
  };
  const result = validateConfigResponse(cfg);
  expect(result.errors.filter(e => e.includes('dimension'))).toHaveLength(0);
});

// ── M-6: null guards in history search ──────────────────────────────────────

test('history search uses null-safe concatenation', () => {
  expect(indexSrc).toMatch(/\(c\.company\|\|''\)\+\(c\.product\|\|''\)\+\(c\.vertical\|\|''\)/);
});

// ── M-7: debounce in updateCell ──────────────────────────────────────────────

test('updateCell uses debounceRef + setTimeout instead of direct saveLibrary', () => {
  expect(indexSrc).toMatch(/debounceRef/);
  expect(indexSrc).toMatch(/clearTimeout\(debounceRef\.current\)/);
  expect(indexSrc).toMatch(/setTimeout.*saveLibrary/s);
});

// ── M-8: no window.confirm in deleteRow ─────────────────────────────────────

test('deleteRow does not use window.confirm', () => {
  expect(indexSrc).not.toMatch(/confirm\('Delete this row\?'\)/);
});

test('deleteRow uses pendingDelete state for confirmation', () => {
  expect(indexSrc).toMatch(/pendingDelete/);
  expect(indexSrc).toMatch(/setPendingDelete/);
});
