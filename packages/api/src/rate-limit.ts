import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimiterOptions = { windowMs: 60_000, maxRequests: 100 }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  middleware() {
    return async (c: Context, next: Next) => {
      const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
      const now = Date.now();
      const entry = this.store.get(ip);

      if (!entry || now >= entry.resetAt) {
        this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
        await next();
        return;
      }

      if (entry.count >= this.maxRequests) {
        return c.json(
          { error: 'Rate limit exceeded', retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
          429
        );
      }

      entry.count++;
      await next();
    };
  }

  /** Reset all entries (for testing) */
  reset(): void {
    this.store.clear();
  }
}
