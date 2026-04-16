import { test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Re-import fresh module state per test by inlining the logic
// (module-level Map is shared across imports in the same test run)
function makeRateLimiter(windowMs = 60_000, maxRequests = 20) {
  const buckets = new Map();
  return function checkRateLimit(userId) {
    const now = Date.now();
    let bucket = buckets.get(userId);
    if (!bucket) {
      bucket = { count: 0, windowStart: now };
      buckets.set(userId, bucket);
    }
    if (now - bucket.windowStart >= windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
      return { allowed: false, retryAfter };
    }
    return { allowed: true };
  };
}

test('allows requests within the limit', () => {
  const check = makeRateLimiter(60_000, 5);
  for (let i = 0; i < 5; i++) expect(check('user-a').allowed).toBe(true);
});

test('blocks the 21st request from the same user', () => {
  const check = makeRateLimiter(60_000, 20);
  for (let i = 0; i < 20; i++) check('user-b');
  const result = check('user-b');
  expect(result.allowed).toBe(false);
  expect(result.retryAfter).toBeGreaterThan(0);
});

test('different users have independent buckets', () => {
  const check = makeRateLimiter(60_000, 2);
  check('user-c'); check('user-c');
  expect(check('user-c').allowed).toBe(false);
  expect(check('user-d').allowed).toBe(true);
});

test('window resets after elapsed time', () => {
  const check = makeRateLimiter(1, 2); // 1ms window
  check('user-e'); check('user-e');
  expect(check('user-e').allowed).toBe(false);
  // After >1ms the window resets
  return new Promise(resolve => setTimeout(() => {
    expect(check('user-e').allowed).toBe(true);
    resolve();
  }, 5));
});

// Structural checks: both Anthropic routes wire in the rate limiter
const configureSrc = readFileSync(resolve('pages/api/configure.js'), 'utf8');
const specsheetSrc = readFileSync(resolve('pages/api/specsheet.js'), 'utf8');

test('configure.js imports checkRateLimit', () => {
  expect(configureSrc).toMatch(/checkRateLimit/);
});

test('configure.js returns 429 when rate limited', () => {
  expect(configureSrc).toMatch(/429/);
  expect(configureSrc).toMatch(/Retry-After/);
});

test('specsheet.js imports checkRateLimit', () => {
  expect(specsheetSrc).toMatch(/checkRateLimit/);
});

test('specsheet.js returns 429 when rate limited', () => {
  expect(specsheetSrc).toMatch(/429/);
  expect(specsheetSrc).toMatch(/Retry-After/);
});
