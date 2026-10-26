/** Token bucket: `capacity` actions, refilled evenly over `windowMs`. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(capacity: number, windowMs: number) {
    this.capacity = capacity;
    this.refillPerMs = capacity / windowMs;
  }

  take(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs);
    bucket.updatedAt = now;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return allowed;
  }

  forget(key: string) {
    this.buckets.delete(key);
  }
}
