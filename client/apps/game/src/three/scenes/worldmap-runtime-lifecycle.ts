import { SceneName } from "../types";

interface WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout> {
  pendingArmyRemovals: Map<TEntityId, TTimeout>;
  pendingArmyRemovalMeta: Map<TEntityId, unknown>;
  deferredChunkRemovals: Map<TEntityId, unknown>;
  armyLastTileSyncAt: Map<TEntityId, number>;
  armyLastLiveUpdateAt?: Map<TEntityId, number>;
  pendingArmyMovements: Set<TEntityId>;
  pendingArmyMovementStartedAt: Map<TEntityId, number>;
  pendingArmyMovementFallbackTimeouts: Map<TEntityId, TTimeout>;
  pendingArmyMovementTargetKeys: Map<TEntityId, string>;
  pendingArmyMovementAuthoritativeResolutions: Set<TEntityId>;
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
  armyLastLiveUpdateAt,
  pendingArmyMovements,
  pendingArmyMovementStartedAt,
  pendingArmyMovementFallbackTimeouts,
  pendingArmyMovementTargetKeys,
  pendingArmyMovementAuthoritativeResolutions,
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
  armyLastLiveUpdateAt?.clear();
  pendingArmyMovements.forEach((entityId) => clearPendingArmyMovement(entityId));
  pendingArmyMovements.clear();
  pendingArmyMovementStartedAt.clear();
  pendingArmyMovementFallbackTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingArmyMovementFallbackTimeouts.clear();
  pendingArmyMovementTargetKeys.clear();
  pendingArmyMovementAuthoritativeResolutions.clear();
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
