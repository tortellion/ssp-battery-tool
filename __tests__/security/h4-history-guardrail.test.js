import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateSpecSheet } from '../../lib/guardrails';

const historySrc = readFileSync(resolve('pages/api/history.js'), 'utf8');
const indexSrc   = readFileSync(resolve('pages/index.jsx'), 'utf8');

// ── Server-side guardrail gate ───────────────────────────────────────────────

test('history.js imports validateSpecSheet', () => {
  expect(historySrc).toMatch(/import.*validateSpecSheet.*guardrails/);
});

test('history.js calls validateSpecSheet before insert', () => {
  expect(historySrc).toMatch(/validateSpecSheet\(spec_content\)/);
});

test('history.js returns 422 on guardrail violation', () => {
  expect(historySrc).toMatch(/422/);
  expect(historySrc).toMatch(/violations/);
});

// ── validateSpecSheet rejects banned spec_content ────────────────────────────

test('validateSpecSheet rejects spec with banned phrase', () => {
  const bad = {
    product_name: 'Test', company_name: 'Acme',
    fire_safety: 'zero fire events in all testing',
    proof_points: [
      '2+ years of continuous deployment in marine environments',
      '6 MW shipped in 2025 across 30+ production SKUs',
      'Customers include Huntington Ingalls Industries, HAVOCAI, and VATN',
      'IBEX 2025 Innovation Award (NMMA)',
    ],
    comparison_rows: [],
  };
  const result = validateSpecSheet(bad);
  expect(result.ok).toBe(false);
  expect(result.violations.some(v => v.phrase === 'zero fire events')).toBe(true);
});

// ── HistoryTab warning banner ────────────────────────────────────────────────

test('HistoryTab imports validateSpecSheet', () => {
  expect(indexSrc).toMatch(/import.*validateSpecSheet.*guardrails/);
});

test('HistoryTab renders guardrail warning when validation fails', () => {
  expect(indexSrc).toMatch(/validateSpecSheet\(selected\.spec_content\)/);
  expect(indexSrc).toMatch(/Guardrail warning/);
});
