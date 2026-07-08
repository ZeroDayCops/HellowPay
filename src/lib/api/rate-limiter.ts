/**
 * HollowPay — In-Memory Sliding-Window Rate Limiter
 *
 * Tracks requests per unique key identifier and restricts traffic
 * to prevent denial-of-service vectors and credentials brute-forcing.
 */

import { RateLimitError } from './errors';

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

/**
 * Validates request counts against rate limit policies.
 * Throws a RateLimitError if exceeded.
 *
 * @param identifier - unique key to rate limit (e.g. project ID or client IP)
 * @param limit - max allowed requests per window
 * @param windowMs - reset window size in milliseconds (default 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60000
): void {
  const now = Date.now();
  const state = memoryStore.get(identifier);

  if (!state) {
    memoryStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return;
  }

  // If window has passed, reset the bucket count and reset timer
  if (now > state.resetTime) {
    state.count = 1;
    state.resetTime = now + windowMs;
    return;
  }

  state.count += 1;

  if (state.count > limit) {
    throw new RateLimitError(
      `Rate limit exceeded for resource. Maximum ${limit} requests allowed per minute.`
    );
  }
}
