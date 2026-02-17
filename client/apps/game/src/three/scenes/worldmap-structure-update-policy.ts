interface StructureTileUpdateDecisionInput {
  hasPositions: boolean;
  countChanged: boolean;
}

interface StructureTileUpdateActions {
  shouldScheduleTileRefresh: boolean;
  shouldClearCache: boolean;
  shouldRefreshVisibleChunks: boolean;
  shouldUpdateTotalStructures: boolean;
}

/**
 * Resolve worldmap structure-tile update actions.
 * Count changes take precedence and trigger a full visible-chunk refresh path.
 */
export function resolveStructureTileUpdateActions(input: StructureTileUpdateDecisionInput): StructureTileUpdateActions {
  if (input.countChanged) {
    return {
      shouldScheduleTileRefresh: false,
      shouldClearCache: true,
      shouldRefreshVisibleChunks: true,
      shouldUpdateTotalStructures: true,
    };
  }

  return {
    shouldScheduleTileRefresh: input.hasPositions,
    shouldClearCache: false,
    shouldRefreshVisibleChunks: false,
    shouldUpdateTotalStructures: false,
  };
}
