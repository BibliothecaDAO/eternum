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
