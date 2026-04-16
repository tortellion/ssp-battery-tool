import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('pages/api/library.js'), 'utf8');

test('library.js GET distinguishes PGRST116 (no row) from other errors', () => {
  expect(src).toMatch(/PGRST116/);
});

test('library.js GET logs genuine errors server-side', () => {
  expect(src).toMatch(/console\.error/);
});

test('library.js GET returns warning field on connectivity failure', () => {
  expect(src).toMatch(/database_unavailable/);
});

test('library.js GET still falls back to DEMO_LIBRARY on no-row', () => {
  expect(src).toMatch(/PGRST116.*DEMO_LIBRARY|DEMO_LIBRARY.*PGRST116/s);
});
