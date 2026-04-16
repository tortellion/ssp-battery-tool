import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('pages/api/history.js'), 'utf8');

test('history GET selects user_email column', () => {
  expect(src).toMatch(/select\(.*user_email/s);
});

test('history POST inserts user_email from session', () => {
  expect(src).toMatch(/user_email:\s*session\.user\.email/);
});
