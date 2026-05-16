export type WorldmapRenderAreaHydrationStage = "tileOpt" | "explorerTroops" | "structures";

export interface WorldmapRenderAreaHydrationState {
  completedStages: Map<string, Set<WorldmapRenderAreaHydrationStage>>;
  pendingStages: Map<string, Map<WorldmapRenderAreaHydrationStage, Promise<boolean>>>;
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

export function listCompletedRenderAreaHydrationKeys(state: WorldmapRenderAreaHydrationState): string[] {
  return Array.from(state.completedStages.keys());
}

export function listPendingRenderAreaHydrationKeys(state: WorldmapRenderAreaHydrationState): string[] {
  return Array.from(state.pendingStages.keys());
}
