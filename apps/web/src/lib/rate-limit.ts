/**
 * Simple in-memory rate limiter for sensitive POSTs.
 * Per-process only — fine for single-node local / small deploy.
 * Resets on process restart.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
};

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
      limit,
    };
  }
  return { ok: true, remaining, retryAfterMs: 0, limit };
}

/** Best-effort prune of expired buckets (call occasionally). */
export function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/** Test helper — clear all buckets. */
export function __resetRateLimitForTests() {
  buckets.clear();
}
