import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('pages/api/configure.js'), 'utf8');

test('configure.js does not destructure library from req.body', () => {
  // Must not pull library out of req.body
  expect(src).not.toMatch(/const\s*\{[^}]*\blibrary\b[^}]*\}\s*=\s*req\.body/);
});

test('configure.js fetches library from Supabase server-side', () => {
  expect(src).toMatch(/supabase.*component_library/s);
});

test('configure.js falls back to DEMO_LIBRARY when no row exists', () => {
  expect(src).toMatch(/DEMO_LIBRARY/);
  expect(src).toMatch(/PGRST116/);
});

test('configure.js returns 503 on genuine library fetch error', () => {
  expect(src).toMatch(/503/);
});
