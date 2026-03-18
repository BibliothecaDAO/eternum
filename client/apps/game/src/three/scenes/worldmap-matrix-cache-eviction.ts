/**
 * Pure helper for matrix cache eviction under pinning pressure.
 *
 * Extracted from `WorldmapScene.ensureMatrixCacheLimit` so the logic is
 * independently testable without instantiating the full scene graph.
 */

interface MatrixCacheEvictionResult {
  /** Keys that were evicted (in eviction order). */
  evictedKeys: string[];
  /** Whether eviction was limited by all remaining entries being pinned. */
  limitedByPinning: boolean;
}

/**
 * Determine which keys to evict from the matrix cache.
 *
 * Returns the list of keys that should be evicted and whether the eviction
 * was limited because all remaining entries are pinned.
 *
 * The caller is responsible for actually disposing the matrices and updating
 * the order array.
 */
export function computeMatrixCacheEvictions(
  cachedMatrixOrder: string[],
  pinnedChunkKeys: ReadonlySet<string>,
  maxMatrixCacheSize: number,
): MatrixCacheEvictionResult {
  if (cachedMatrixOrder.length <= maxMatrixCacheSize) {
    return { evictedKeys: [], limitedByPinning: false };
  }

  // Count non-pinned entries upfront so we know the eviction budget.
  const nonPinnedCount = cachedMatrixOrder.filter((k) => !pinnedChunkKeys.has(k)).length;

  // If removing all non-pinned entries still won't bring us under the limit,
  // we are pinning-limited. If there are zero non-pinned entries, bail
  // immediately — there is nothing to evict.
  if (nonPinnedCount === 0) {
    return { evictedKeys: [], limitedByPinning: true };
  }

  const evictedKeys: string[] = [];
  let nonPinnedSeen = 0;

  // Walk the order array (oldest-first). Pinned keys are re-enqueued at the
  // back; non-pinned keys are collected for eviction. We stop as soon as
  // the effective length (total minus evicted) drops to the limit, or we
  // have cycled through all non-pinned keys.
  const originalLength = cachedMatrixOrder.length;
  let readIndex = 0;

  while (
    originalLength - evictedKeys.length > maxMatrixCacheSize &&
    nonPinnedSeen < nonPinnedCount &&
    readIndex < originalLength
  ) {
    const key = cachedMatrixOrder[readIndex];
    readIndex++;

    if (!key) break;

    if (pinnedChunkKeys.has(key)) {
      // Pinned — skip, will remain in the order.
      continue;
    }

    nonPinnedSeen++;
    evictedKeys.push(key);
  }

  const limitedByPinning =
    originalLength - evictedKeys.length > maxMatrixCacheSize;

  return { evictedKeys, limitedByPinning };
}
