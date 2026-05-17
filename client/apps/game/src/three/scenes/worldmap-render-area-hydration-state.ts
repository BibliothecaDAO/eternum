export type WorldmapRenderAreaHydrationStage = "tileOpt" | "explorerTroops" | "structures";

export interface WorldmapRenderAreaHydrationState {
  completedStages: Map<string, Set<WorldmapRenderAreaHydrationStage>>;
  pendingStages: Map<string, Map<WorldmapRenderAreaHydrationStage, Promise<boolean>>>;
}

interface RecentRenderAreaRetentionInput {
  retainedAreaKeys: readonly string[];
  recentlyUnpinnedAreaKeys: readonly string[];
  protectedAreaKeys: ReadonlySet<string>;
  maxRetainedAreas: number;
  isAreaCoveredByActiveSubscription?: (areaKey: string) => boolean;
}

interface RecentRenderAreaRetentionResult {
  nextRetainedAreaKeys: string[];
  areaKeysToClear: string[];
  areaKeysToRetainTerrainOnly: string[];
}

interface FetchResultRetainedAreaKeysInput {
  pinnedAreaKeys: ReadonlySet<string>;
  directionalPrefetchAreaKeys: ReadonlySet<string>;
  retainedAreaKeys: readonly string[];
  isRetainedAreaCoveredByActiveSubscription?: (areaKey: string) => boolean;
}

export const WORLDMAP_PREFETCH_HYDRATION_STAGES: readonly WorldmapRenderAreaHydrationStage[] = [
  "tileOpt",
  "explorerTroops",
];

export const WORLDMAP_ACTIVE_HYDRATION_STAGES: readonly WorldmapRenderAreaHydrationStage[] = [
  "tileOpt",
  "explorerTroops",
  "structures",
];

export function createWorldmapRenderAreaHydrationState(): WorldmapRenderAreaHydrationState {
  return {
    completedStages: new Map(),
    pendingStages: new Map(),
  };
}

export function isRenderAreaHydrationComplete(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  requiredStages: readonly WorldmapRenderAreaHydrationStage[],
): boolean {
  const completedStages = state.completedStages.get(areaKey);
  return !!completedStages && requiredStages.every((stage) => completedStages.has(stage));
}

export function getMissingRenderAreaHydrationStages(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  requiredStages: readonly WorldmapRenderAreaHydrationStage[],
): WorldmapRenderAreaHydrationStage[] {
  const completedStages = state.completedStages.get(areaKey);
  return requiredStages.filter((stage) => !completedStages?.has(stage));
}

export function getPendingRenderAreaHydrationPromise(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
): Promise<boolean> | null {
  const pendingStages = state.pendingStages.get(areaKey);
  if (!pendingStages) {
    return null;
  }

  let owner: Promise<boolean> | null = null;
  for (const stage of stages) {
    const pendingStage = pendingStages.get(stage);
    if (!pendingStage) {
      return null;
    }
    if (!owner) {
      owner = pendingStage;
      continue;
    }
    if (owner !== pendingStage) {
      return null;
    }
  }

  return owner;
}

export function getPendingRenderAreaHydrationPromises(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
): Promise<boolean>[] {
  const pendingStages = state.pendingStages.get(areaKey);
  if (!pendingStages) {
    return [];
  }

  const promises: Promise<boolean>[] = [];
  stages.forEach((stage) => {
    const pendingStage = pendingStages.get(stage);
    if (pendingStage) {
      promises.push(pendingStage);
    }
  });

  return Array.from(new Set(promises));
}

export function getPendingRenderAreaHydrationStages(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
): WorldmapRenderAreaHydrationStage[] {
  const pendingStages = state.pendingStages.get(areaKey);
  if (!pendingStages) {
    return [];
  }

  return stages.filter((stage) => pendingStages.has(stage));
}

export function registerPendingRenderAreaHydration(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
  fetchPromise: Promise<boolean>,
): void {
  const pendingStages = state.pendingStages.get(areaKey) ?? new Map();
  stages.forEach((stage) => pendingStages.set(stage, fetchPromise));
  state.pendingStages.set(areaKey, pendingStages);
}

export function finalizePendingRenderAreaHydrationOwnership(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
  fetchPromise: Promise<boolean>,
): boolean {
  const pendingStages = state.pendingStages.get(areaKey);
  if (!pendingStages) {
    return false;
  }

  const ownsAllStages = stages.every((stage) => pendingStages.get(stage) === fetchPromise);
  if (!ownsAllStages) {
    return false;
  }

  stages.forEach((stage) => pendingStages.delete(stage));
  if (pendingStages.size === 0) {
    state.pendingStages.delete(areaKey);
  }
  return true;
}

export function markRenderAreaHydrationStagesComplete(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stages: readonly WorldmapRenderAreaHydrationStage[],
): void {
  const completedStages = state.completedStages.get(areaKey) ?? new Set<WorldmapRenderAreaHydrationStage>();
  stages.forEach((stage) => completedStages.add(stage));
  state.completedStages.set(areaKey, completedStages);
}

export function clearRenderAreaHydrationState(state: WorldmapRenderAreaHydrationState, areaKey: string): void {
  state.completedStages.delete(areaKey);
  state.pendingStages.delete(areaKey);
}

export function clearCompletedRenderAreaHydrationState(state: WorldmapRenderAreaHydrationState, areaKey: string): void {
  state.completedStages.delete(areaKey);
}

export function clearAllRenderAreaHydrationState(state: WorldmapRenderAreaHydrationState): void {
  state.completedStages.clear();
  state.pendingStages.clear();
}

export function retainRenderAreaHydrationStages(
  state: WorldmapRenderAreaHydrationState,
  areaKey: string,
  stagesToRetain: readonly WorldmapRenderAreaHydrationStage[],
): void {
  const retainedStages = new Set(stagesToRetain);
  const completedStages = state.completedStages.get(areaKey);
  if (completedStages) {
    completedStages.forEach((stage) => {
      if (!retainedStages.has(stage)) {
        completedStages.delete(stage);
      }
    });
    if (completedStages.size === 0) {
      state.completedStages.delete(areaKey);
    }
  }

  const pendingStages = state.pendingStages.get(areaKey);
  if (pendingStages) {
    pendingStages.forEach((_, stage) => {
      if (!retainedStages.has(stage)) {
        pendingStages.delete(stage);
      }
    });
    if (pendingStages.size === 0) {
      state.pendingStages.delete(areaKey);
    }
  }
}

function addUniqueAreaKey(areaKeys: string[], areaKey: string): void {
  if (!areaKeys.includes(areaKey)) {
    areaKeys.push(areaKey);
  }
}

function removeAreaKey(areaKeys: string[], areaKey: string): void {
  const existingIndex = areaKeys.indexOf(areaKey);
  if (existingIndex >= 0) {
    areaKeys.splice(existingIndex, 1);
  }
}

export function resolveRecentRenderAreaRetention({
  maxRetainedAreas,
  protectedAreaKeys,
  recentlyUnpinnedAreaKeys,
  retainedAreaKeys,
  isAreaCoveredByActiveSubscription,
}: RecentRenderAreaRetentionInput): RecentRenderAreaRetentionResult {
  const areaKeysToClear: string[] = [];
  const areaKeysToRetainTerrainOnly: string[] = [];
  const nextRetainedAreaKeys: string[] = [];

  const retainAreaKey = (areaKey: string, shouldRefreshRecency: boolean): void => {
    if (protectedAreaKeys.has(areaKey)) {
      return;
    }

    if (shouldRefreshRecency) {
      removeAreaKey(nextRetainedAreaKeys, areaKey);
    }

    if (isAreaCoveredByActiveSubscription && !isAreaCoveredByActiveSubscription(areaKey)) {
      addUniqueAreaKey(areaKeysToRetainTerrainOnly, areaKey);
    }

    addUniqueAreaKey(nextRetainedAreaKeys, areaKey);
  };

  retainedAreaKeys.forEach((areaKey) => {
    retainAreaKey(areaKey, false);
  });

  recentlyUnpinnedAreaKeys.forEach((areaKey) => {
    retainAreaKey(areaKey, true);
  });

  while (nextRetainedAreaKeys.length > Math.max(0, maxRetainedAreas)) {
    const evictedAreaKey = nextRetainedAreaKeys.shift();
    if (evictedAreaKey) {
      removeAreaKey(areaKeysToRetainTerrainOnly, evictedAreaKey);
      areaKeysToClear.push(evictedAreaKey);
    }
  }

  return {
    areaKeysToClear,
    areaKeysToRetainTerrainOnly,
    nextRetainedAreaKeys,
  };
}

export function resolveFetchResultRetainedAreaKeys({
  directionalPrefetchAreaKeys,
  isRetainedAreaCoveredByActiveSubscription,
  pinnedAreaKeys,
  retainedAreaKeys,
}: FetchResultRetainedAreaKeysInput): Set<string> {
  const retainedAreaKeySet = new Set([...pinnedAreaKeys, ...directionalPrefetchAreaKeys]);
  retainedAreaKeys.forEach((areaKey) => {
    if (isRetainedAreaCoveredByActiveSubscription && !isRetainedAreaCoveredByActiveSubscription(areaKey)) {
      return;
    }
    retainedAreaKeySet.add(areaKey);
  });
  return retainedAreaKeySet;
}

export function listCompletedRenderAreaHydrationKeys(state: WorldmapRenderAreaHydrationState): string[] {
  return Array.from(state.completedStages.keys());
}

export function listPendingRenderAreaHydrationKeys(state: WorldmapRenderAreaHydrationState): string[] {
  return Array.from(state.pendingStages.keys());
}
