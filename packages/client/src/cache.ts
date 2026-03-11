interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ViewCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number = 5000, maxSize: number = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize > 0 ? maxSize : 1;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Refresh recency for LRU eviction.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.evictExpiredEntries();
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else {
      this.evictLeastRecentlyUsed();
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictLeastRecentlyUsed(): void {
    if (this.cache.size < this.maxSize) {
      return;
    }
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }
}
