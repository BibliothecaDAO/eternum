import { SceneName } from "../types";

interface WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout, TPendingChunk> {
  pendingArmyRemovals: Map<TEntityId, TTimeout>;
  pendingArmyRemovalMeta: Map<TEntityId, unknown>;
  deferredChunkRemovals: Map<TEntityId, unknown>;
  armyLastUpdateAt: Map<TEntityId, number>;
  pendingArmyMovements: Set<TEntityId>;
  pendingArmyMovementStartedAt: Map<TEntityId, number>;
  pendingArmyMovementFallbackTimeouts: Map<TEntityId, TTimeout>;
  armyStructureOwners: Map<TEntityId, unknown>;
  suppressedArmies?: Set<TEntityId>;
  fetchedChunks: Set<string>;
  pendingChunks: Map<string, TPendingChunk>;
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

interface FinalizePendingChunkFetchOwnershipInput<TPendingChunkPromise> {
  pendingChunks: Map<string, WorldmapPendingChunkFetch<TPendingChunkPromise>>;
  fetchKey: string;
  fetchPromise: unknown;
}

interface ResolvePendingWorldmapChunkFetchPromiseInput<TPendingChunkPromise> {
  pendingChunks: Map<string, WorldmapPendingChunkFetch<TPendingChunkPromise>>;
  fetchKey: string;
  activeFetchGeneration: number;
}

interface ShouldApplyWorldmapFetchResultInput {
  fetchGeneration: number;
  activeFetchGeneration: number;
  fetchKey: string;
  pinnedRenderAreas: Set<string>;
}

export interface WorldmapPendingChunkFetch<TPendingChunkPromise> {
  fetchGeneration: number;
  promise: TPendingChunkPromise;
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
  suppressedArmies,
  fetchedChunks,
  pendingChunks,
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
}: WorldmapSwitchOffRuntimeStateInput<TEntityId, TTimeout, TPendingChunk>): WorldmapSwitchOffRuntimeStateResult => {
  pendingArmyRemovals.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingArmyRemovals.clear();
  pendingArmyRemovalMeta.clear();
  deferredChunkRemovals.clear();
  armyLastUpdateAt.clear();
  pendingArmyMovements.forEach((entityId) => clearPendingArmyMovement(entityId));
  pendingArmyMovements.clear();
  pendingArmyMovementStartedAt.clear();
  pendingArmyMovementFallbackTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingArmyMovementFallbackTimeouts.clear();
  armyStructureOwners.clear();
  suppressedArmies?.clear();

  clearStreamingWork();
  clearQueuedPrefetchState();
  invalidatePendingFetches();
  fetchedChunks.clear();
  pendingChunks.clear();
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

/**
 * Finalize pending fetch ownership only if the settling promise still owns the key.
 */
export const finalizePendingChunkFetchOwnership = <TPendingChunkPromise>({
  pendingChunks,
  fetchKey,
  fetchPromise,
}: FinalizePendingChunkFetchOwnershipInput<TPendingChunkPromise>): boolean => {
  const currentOwner = pendingChunks.get(fetchKey);
  if (!currentOwner || currentOwner.promise !== fetchPromise) {
    return false;
  }

  pendingChunks.delete(fetchKey);
  return true;
};

export const resolvePendingWorldmapChunkFetchPromise = <TPendingChunkPromise>({
  pendingChunks,
  fetchKey,
  activeFetchGeneration,
}: ResolvePendingWorldmapChunkFetchPromiseInput<TPendingChunkPromise>): TPendingChunkPromise | null => {
  const currentOwner = pendingChunks.get(fetchKey);
  if (!currentOwner) {
    return null;
  }

  return currentOwner.fetchGeneration === activeFetchGeneration ? currentOwner.promise : null;
};

export const invalidateWorldmapPendingFetchGeneration = (currentGeneration: number): number => currentGeneration + 1;

export const shouldApplyWorldmapFetchResult = ({
  fetchGeneration,
  activeFetchGeneration,
  fetchKey,
  pinnedRenderAreas,
}: ShouldApplyWorldmapFetchResultInput): boolean => {
  return fetchGeneration === activeFetchGeneration && pinnedRenderAreas.has(fetchKey);
};
