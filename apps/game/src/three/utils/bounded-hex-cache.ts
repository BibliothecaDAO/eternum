/**
 * Phase 3.1: a small bounded memo keyed by hex (col,row).
 *
 * Used to cache values that are immutable per hex but otherwise expensive to
 * derive every frame — notably the biome at a hex (BigInt/simplex-noise
 * resolution), which moving armies resolved twice per frame per entity. Because
 * the cached value is immutable for a hex, eviction only ever costs a re-resolve,
 * never correctness, so a simple insertion-order (FIFO) eviction is sufficient.
 */
export class BoundedHexCache<T> {
  private readonly cache = new Map<string, T>();

  constructor(private readonly maxSize = 4096) {}

  get(col: number, row: number, resolve: (col: number, row: number) => T): T {
    const key = `${col},${row}`;
    const cached = this.cache.get(key);
    if (cached !== undefined || this.cache.has(key)) {
      return cached as T;
    }

    // resolve receives (col,row) so callers can pass a stable, pre-bound resolver
    // and avoid allocating a closure per lookup on the frame path.
    const value = resolve(col, row);
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, value);
    return value;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
