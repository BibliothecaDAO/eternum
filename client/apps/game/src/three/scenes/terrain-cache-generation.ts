/**
 * Generation counter for detecting stale terrain caches.
 *
 * Bumped on every exploredTiles mutation so that caches created
 * at an earlier generation can be rejected on read.
 */

interface TerrainCacheGeneration {
  current(): number;
  bump(): void;
}

export function createTerrainCacheGeneration(): TerrainCacheGeneration {
  let generation = 0;
  return {
    current: () => generation,
    bump: () => {
      generation += 1;
    },
  };
}

export function isTerrainCacheStale(cachedGeneration: number | undefined, currentGeneration: number): boolean {
  if (cachedGeneration === undefined) return true;
  return cachedGeneration !== currentGeneration;
}
