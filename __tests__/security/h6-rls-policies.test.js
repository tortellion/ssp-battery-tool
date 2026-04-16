import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const schema = readFileSync(resolve('supabase/schema.sql'), 'utf8');

test('schema.sql has explicit UPDATE policy on configurations', () => {
  expect(schema).toMatch(/configurations FOR UPDATE/);
});

test('schema.sql UPDATE policy scoped to auth.uid() = user_id', () => {
  expect(schema).toMatch(/FOR UPDATE[\s\S]*?auth\.uid\(\) = user_id/);
});

test('schema.sql has explicit DELETE policy on configurations', () => {
  expect(schema).toMatch(/configurations FOR DELETE/);
});

test('schema.sql DELETE policy scoped to auth.uid() = user_id', () => {
  expect(schema).toMatch(/FOR DELETE[\s\S]*?auth\.uid\(\) = user_id/);
});
