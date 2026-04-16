// H-1: in-memory per-user rate limiter for Anthropic API routes.
// 20 requests per 60-second sliding window per user ID.
// Replace with Upstash Redis for multi-instance / persistent enforcement.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const buckets = new Map();

export function checkRateLimit(userId) {
  const now = Date.now();
  let bucket = buckets.get(userId);

  if (!bucket) {
    bucket = { count: 0, windowStart: now };
    buckets.set(userId, bucket);
  }

  if (now - bucket.windowStart >= WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}
