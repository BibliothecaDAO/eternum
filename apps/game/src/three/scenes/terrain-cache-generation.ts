/**
 * Per-chunk generation counters for detecting stale terrain caches.
 *
 * Each cached chunk records the generation it was built at. A tile mutation
 * bumps the generation of only the chunk keys whose render window contains the
 * mutated hex, so an unrelated chunk's cached terrain is not invalidated. (The
 * previous single global counter advanced on every tile change anywhere, which
 * made every cached chunk read as stale during exploration.)
 */

interface TerrainCacheGeneration {
  /** Current generation for a chunk key (0 if never bumped). */
  current(chunkKey: string): number;
  /** Increment the generation of each provided chunk key. */
  bump(chunkKeys: Iterable<string>): void;
  /** Drop generations for chunks that no longer have retained render state. */
  retain(chunkKeys: ReadonlySet<string>): void;
  /** Reset all chunk generations (used on a full cache flush). */
  clear(): void;
}

export function createTerrainCacheGeneration(): TerrainCacheGeneration {
  const generations = new Map<string, number>();
  return {
    current: (chunkKey: string) => generations.get(chunkKey) ?? 0,
    bump: (chunkKeys: Iterable<string>) => {
      for (const chunkKey of chunkKeys) {
        generations.set(chunkKey, (generations.get(chunkKey) ?? 0) + 1);
      }
    },
    retain: (chunkKeys) => {
      for (const chunkKey of generations.keys()) {
        if (!chunkKeys.has(chunkKey)) {
          generations.delete(chunkKey);
        }
      }
    },
    clear: () => {
      generations.clear();
    },
  };
}

export function isTerrainCacheStale(cachedGeneration: number | undefined, currentGeneration: number): boolean {
  if (cachedGeneration === undefined) return true;
  return cachedGeneration !== currentGeneration;
}
