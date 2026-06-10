interface StructureTileUpdateDecisionInput {
  hasPositions: boolean;
  countChanged: boolean;
}

interface StructureTileUpdateActions {
  shouldScheduleTileRefresh: boolean;
  /**
   * Invalidate only the cached chunks overlapping the affected structure hex.
   * Replaces the previous full-cache flush: a structure count change anywhere in
   * synced bounds used to destroy every cached chunk matrix set plus the global
   * matrix/attribute pools and hydration state, forcing a full rebuild. The
   * cached terrain only changes for chunks that contain the structure, so
   * invalidation is scoped to those.
   */
  shouldInvalidateAffectedChunks: boolean;
  shouldRefreshVisibleChunks: boolean;
  shouldUpdateTotalStructures: boolean;
}

/**
 * Resolve worldmap structure-tile update actions.
 * Count changes take precedence and trigger a targeted invalidate + visible-chunk refresh path.
 */
export function resolveStructureTileUpdateActions(input: StructureTileUpdateDecisionInput): StructureTileUpdateActions {
  if (input.countChanged) {
    return {
      shouldScheduleTileRefresh: false,
      shouldInvalidateAffectedChunks: true,
      shouldRefreshVisibleChunks: true,
      shouldUpdateTotalStructures: true,
    };
  }

  return {
    shouldScheduleTileRefresh: input.hasPositions,
    shouldInvalidateAffectedChunks: false,
    shouldRefreshVisibleChunks: false,
    shouldUpdateTotalStructures: false,
  };
}
