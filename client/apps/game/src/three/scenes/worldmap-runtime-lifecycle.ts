interface WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout, TPendingChunk> {
  pendingArmyRemovals: Map<TEntityId, TTimeout>;
  pendingArmyRemovalMeta: Map<TEntityId, unknown>;
  deferredChunkRemovals: Map<TEntityId, unknown>;
  armyLastUpdateAt: Map<TEntityId, number>;
  pendingArmyMovements: Set<TEntityId>;
  pendingArmyMovementStartedAt: Map<TEntityId, number>;
  pendingArmyMovementFallbackTimeouts: Map<TEntityId, TTimeout>;
  armyStructureOwners: Map<TEntityId, unknown>;
  fetchedChunks: Set<string>;
  pendingChunks: Map<string, TPendingChunk>;
  pinnedChunkKeys: Set<string>;
  pinnedRenderAreas: Set<string>;
  clearTimeout: (timeoutId: TTimeout) => void;
  clearPendingArmyMovement: (entityId: TEntityId) => void;
  clearQueuedPrefetchState: () => void;
}

interface WorldmapSwitchOffRuntimeStateResult {
  isSwitchedOff: boolean;
  toriiLoadingCounter: number;
  currentChunk: string;
  lastControlsCameraDistance: null;
}

interface WorldmapSwitchOffTransitionStateInput<TChunkSwitchPromise> {
  chunkTransitionToken: number;
  isChunkTransitioning: boolean;
  globalChunkSwitchPromise: TChunkSwitchPromise | null;
}

interface WorldmapSwitchOffTransitionStateResult {
  chunkTransitionToken: number;
  isChunkTransitioning: boolean;
  globalChunkSwitchPromise: null;
}

interface FinalizePendingChunkFetchOwnershipInput<TPendingChunk> {
  pendingChunks: Map<string, TPendingChunk>;
  fetchKey: string;
  fetchPromise: TPendingChunk;
}

export const applyWorldmapSwitchOffRuntimeState = <TEntityId, TTimeout, TPendingChunk>({
  pendingArmyRemovals,
  pendingArmyRemovalMeta,
  deferredChunkRemovals,
  armyLastUpdateAt,
  pendingArmyMovements,
  pendingArmyMovementStartedAt,
  pendingArmyMovementFallbackTimeouts,
  armyStructureOwners,
  fetchedChunks,
  pendingChunks,
  pinnedChunkKeys,
  pinnedRenderAreas,
  clearTimeout,
  clearPendingArmyMovement,
  clearQueuedPrefetchState,
}: WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout, TPendingChunk>): WorldmapSwitchOffRuntimeStateResult => {
  pendingArmyRemovals.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingArmyRemovals.clear();
  pendingArmyRemovalMeta.clear();
  deferredChunkRemovals.clear();
  armyLastUpdateAt.clear();
  pendingArmyMovements.forEach((entityId) => clearPendingArmyMovement(entityId));
  pendingArmyMovements.clear();
  pendingArmyMovementStartedAt.clear();
  pendingArmyMovementFallbackTimeouts.clear();
  armyStructureOwners.clear();

  clearQueuedPrefetchState();
  fetchedChunks.clear();
  pendingChunks.clear();
  pinnedChunkKeys.clear();
  pinnedRenderAreas.clear();

  return {
    isSwitchedOff: true,
    toriiLoadingCounter: 0,
    currentChunk: "null",
    lastControlsCameraDistance: null,
  };
};

/**
 * Invalidate any in-flight chunk transition authority during switch-off.
 */
export const invalidateWorldmapSwitchOffTransitionState = <TChunkSwitchPromise>({
  chunkTransitionToken,
}: WorldmapSwitchOffTransitionStateInput<TChunkSwitchPromise>): WorldmapSwitchOffTransitionStateResult => {
  return {
    chunkTransitionToken: chunkTransitionToken + 1,
    isChunkTransitioning: false,
    globalChunkSwitchPromise: null,
  };
};

/**
 * Finalize pending fetch ownership only if the settling promise still owns the key.
 */
export const finalizePendingChunkFetchOwnership = <TPendingChunk>({
  pendingChunks,
  fetchKey,
  fetchPromise,
}: FinalizePendingChunkFetchOwnershipInput<TPendingChunk>): boolean => {
  if (pendingChunks.get(fetchKey) !== fetchPromise) {
    return false;
  }

  pendingChunks.delete(fetchKey);
  return true;
};
