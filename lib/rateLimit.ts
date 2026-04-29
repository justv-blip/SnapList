// Simple in-memory sliding-window rate limiter.
// Good enough for a single-instance Next.js deployment.
// In production behind Cloudflare, WAF-level rate limiting takes over.

interface RateLimitEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export interface RateLimitConfig {
  /** Unique identifier for this limiter (e.g. "auth", "api") */
  id: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
}

/**
 * Check whether a request from `key` (typically IP) is within rate limits.
 * Returns { allowed, remaining, retryAfterSec }.
 */
export function checkRateLimit(
  config: RateLimitConfig,
  key: string
): RateLimitResult {
  if (!stores.has(config.id)) {
    stores.set(config.id, new Map());
  }
  const store = stores.get(config.id)!;

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune old timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.limit) {
    // Oldest timestamp in the window — user must wait until it expires
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
  };
}

// Periodic cleanup to prevent memory leaks from abandoned IPs.
// Runs every 5 minutes, removes entries with no recent activity.
const CLEANUP_INTERVAL = 5 * 60 * 1000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        // Remove if all timestamps are older than 10 minutes
        if (entry.timestamps.every((t) => now - t > 10 * 60 * 1000)) {
          store.delete(key);
        }
      }
    }
  }, CLEANUP_INTERVAL);
}
