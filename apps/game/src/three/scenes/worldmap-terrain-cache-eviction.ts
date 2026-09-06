/**
 * Pure helper for prepared terrain cache eviction under pinning pressure.
 *
 * Extracted from `WorldmapScene.ensurePreparedTerrainCacheLimit` so the logic is
 * independently testable without instantiating the full scene graph.
 */

interface TerrainCacheEvictionResult {
  /** Keys that were evicted (in eviction order). */
  evictedKeys: string[];
  /** Whether eviction was limited by all remaining entries being pinned. */
  limitedByPinning: boolean;
}

/**
 * Determine which keys to evict from the prepared terrain cache.
 *
 * Returns the list of keys that should be evicted and whether the eviction
 * was limited because all remaining entries are pinned.
 *
 * The caller is responsible for removing the cached entries and updating
 * the order array.
 */
export function computeTerrainCacheEvictions(
  preparedTerrainCacheOrder: string[],
  pinnedChunkKeys: ReadonlySet<string>,
  maxPreparedTerrainCacheSize: number,
): TerrainCacheEvictionResult {
  if (preparedTerrainCacheOrder.length <= maxPreparedTerrainCacheSize) {
    return { evictedKeys: [], limitedByPinning: false };
  }

  // Count non-pinned entries upfront so we know the eviction budget.
  const nonPinnedCount = preparedTerrainCacheOrder.filter((k) => !pinnedChunkKeys.has(k)).length;

  // If removing all non-pinned entries still won't bring us under the limit,
  // we are pinning-limited. If there are zero non-pinned entries, bail
  // immediately — there is nothing to evict.
  if (nonPinnedCount === 0) {
    return { evictedKeys: [], limitedByPinning: true };
  }

  const evictedKeys: string[] = [];
  let nonPinnedSeen = 0;

  // Walk the order array (oldest-first). Pinned keys stay in place;
  // non-pinned keys are collected for eviction. We stop as soon as
  // the effective length (total minus evicted) drops to the limit, or we
  // have cycled through all non-pinned keys.
  const originalLength = preparedTerrainCacheOrder.length;
  let readIndex = 0;

  while (
    originalLength - evictedKeys.length > maxPreparedTerrainCacheSize &&
    nonPinnedSeen < nonPinnedCount &&
    readIndex < originalLength
  ) {
    const key = preparedTerrainCacheOrder[readIndex];
    readIndex++;

    if (!key) break;

    if (pinnedChunkKeys.has(key)) {
      // Pinned — skip, will remain in the order.
      continue;
    }

    nonPinnedSeen++;
    evictedKeys.push(key);
  }

  const limitedByPinning = originalLength - evictedKeys.length > maxPreparedTerrainCacheSize;

  return { evictedKeys, limitedByPinning };
}
