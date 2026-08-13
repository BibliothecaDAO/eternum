import { SceneName } from "../types";

interface PendingArmyMovementRecordLike<TTimeout> {
  movement?: { fallbackTimeout?: TTimeout };
}

interface WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout> {
  pendingArmyRemovals: Map<TEntityId, TTimeout>;
  pendingArmyRemovalMeta: Map<TEntityId, unknown>;
  deferredChunkRemovals: Map<TEntityId, unknown>;
  armyLastTileSyncAt: Map<TEntityId, number>;
  pendingArmyMovements: Map<TEntityId, PendingArmyMovementRecordLike<TTimeout>>;
  armyStructureOwners: Map<TEntityId, unknown>;
  suppressedArmies?: Set<TEntityId>;
  clearRenderAreaHydrationState: () => void;
  pinnedChunkKeys: Set<string>;
  pinnedRenderAreas: Set<string>;
  hydratedChunkRefreshes: Set<string>;
  hydratedRefreshSuppressionAreaKeys: Set<string>;
  nextSceneName?: SceneName;
  clearTimeout: (timeoutId: TTimeout) => void;
  clearPendingArmyMovement: (entityId: TEntityId) => void;
  clearStreamingWork: () => void;
  clearQueuedPrefetchState: () => void;
  releaseInactiveResources: () => void;
  invalidatePendingFetches: () => void;
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

interface ShouldApplyWorldmapFetchResultInput {
  fetchGeneration: number;
  activeFetchGeneration: number;
  fetchKey: string;
  retainedRenderAreas: { has(fetchKey: string): boolean };
}

export const applyWorldmapSwitchOffRuntimeState = <TEntityId, TTimeout>({
  pendingArmyRemovals,
  pendingArmyRemovalMeta,
  deferredChunkRemovals,
  armyLastTileSyncAt,
  pendingArmyMovements,
  armyStructureOwners,
  suppressedArmies,
  clearRenderAreaHydrationState,
  pinnedChunkKeys,
  pinnedRenderAreas,
  hydratedChunkRefreshes,
  hydratedRefreshSuppressionAreaKeys,
  nextSceneName,
  clearTimeout,
  clearPendingArmyMovement,
  clearStreamingWork,
  clearQueuedPrefetchState,
  releaseInactiveResources,
  invalidatePendingFetches,
}: WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout>): WorldmapSwitchOffRuntimeStateResult => {
  pendingArmyRemovals.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingArmyRemovals.clear();
  pendingArmyRemovalMeta.clear();
  deferredChunkRemovals.clear();
  armyLastTileSyncAt.clear();
  pendingArmyMovements.forEach((record, entityId) => {
    const fallbackTimeout = record.movement?.fallbackTimeout;
    if (fallbackTimeout !== undefined) {
      clearTimeout(fallbackTimeout);
    }
    clearPendingArmyMovement(entityId);
  });
  // Without this, a tx submitted just before the scene switch strands its
  // record (clearPendingArmyMovement keeps tx-only residue for in-flight
  // receipts) and the army stays locked out of movement selection when the
  // map is re-entered.
  pendingArmyMovements.clear();
  armyStructureOwners.clear();
  suppressedArmies?.clear();

  clearStreamingWork();
  clearQueuedPrefetchState();
  invalidatePendingFetches();
  clearRenderAreaHydrationState();
  pinnedChunkKeys.clear();
  pinnedRenderAreas.clear();
  hydratedChunkRefreshes.clear();
  hydratedRefreshSuppressionAreaKeys.clear();

  if (nextSceneName === SceneName.FastTravel) {
    releaseInactiveResources();
  }

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

export const invalidateWorldmapPendingFetchGeneration = (currentGeneration: number): number => currentGeneration + 1;

export const shouldApplyWorldmapFetchResult = ({
  fetchGeneration,
  activeFetchGeneration,
  fetchKey,
  retainedRenderAreas,
}: ShouldApplyWorldmapFetchResultInput): boolean => {
  return fetchGeneration === activeFetchGeneration && retainedRenderAreas.has(fetchKey);
};
