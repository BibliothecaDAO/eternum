import type { WorldmapForceRefreshReason } from "../perf/worldmap-render-diagnostics";

interface ResolveWorldmapChunkRefreshWorkPolicyInput {
  currentChunk: string;
  targetChunk: string;
  force: boolean;
  reason: WorldmapForceRefreshReason;
}

interface WorldmapChunkRefreshWorkPolicy {
  useBackgroundLane: boolean;
  invalidateCurrentFetchArea: boolean;
  preserveSelection: boolean;
}

const BACKGROUND_SAFE_REFRESH_REASONS = new Set<WorldmapForceRefreshReason>([
  "hydrated_chunk",
  "duplicate_tile",
  "tile_overlap_repair",
  "deferred_transition_tile",
  "structure_count_change",
  "army_dead",
  "terrain_self_heal",
  "offscreen_chunk",
  "visibility_recovery",
]);

const RECOVERY_FETCH_INVALIDATION_REASONS = new Set<WorldmapForceRefreshReason>([
  "duplicate_tile",
  "tile_overlap_repair",
  "structure_count_change",
  "terrain_self_heal",
  "offscreen_chunk",
  "visibility_recovery",
]);

export function resolveWorldmapChunkRefreshWorkPolicy(
  input: ResolveWorldmapChunkRefreshWorkPolicyInput,
): WorldmapChunkRefreshWorkPolicy {
  const isCommittedCurrentChunk = input.currentChunk !== "null";
  const targetsCurrentChunk = isCommittedCurrentChunk && input.currentChunk === input.targetChunk;
  const isBackgroundSafeReason = BACKGROUND_SAFE_REFRESH_REASONS.has(input.reason);
  const useBackgroundLane = targetsCurrentChunk && (isBackgroundSafeReason || input.force);
  const invalidateCurrentFetchArea = useBackgroundLane && RECOVERY_FETCH_INVALIDATION_REASONS.has(input.reason);

  return {
    useBackgroundLane,
    invalidateCurrentFetchArea,
    preserveSelection: useBackgroundLane,
  };
}

export function shouldBlockArmySelectionForChunkWork(input: {
  hasBlockingChunkSwitch: boolean;
  hasBackgroundRefresh: boolean;
}): boolean {
  void input.hasBackgroundRefresh;
  return input.hasBlockingChunkSwitch;
}

export function shouldDeferVisibleTerrainMutationForChunkWork(input: {
  hasBlockingChunkSwitch: boolean;
  hasBackgroundRefresh: boolean;
}): boolean {
  return input.hasBlockingChunkSwitch || input.hasBackgroundRefresh;
}
