interface WorldmapZoomHardeningConfigInput {
  enabled: boolean;
  telemetry: boolean;
}

interface WorldmapZoomHardeningConfig {
  enabled: boolean;
  latestWinsRefresh: boolean;
  terrainSelfHeal: boolean;
  telemetry: boolean;
}

interface WorldmapZoomHardeningRuntimeStateInput {
  chunkRefreshTimeout: number | null;
  chunkRefreshRequestToken: number;
  chunkRefreshAppliedToken: number;
  chunkRefreshRunning: boolean;
  chunkRefreshRerunRequested: boolean;
  pendingChunkRefreshForce: boolean;
  zeroTerrainFrames: number;
  terrainRecoveryInFlight: boolean;
}

interface TerrainVisibilityAnomalyInput {
  terrainInstances: number;
  terrainReferenceInstances: number;
  zeroTerrainFrames: number;
  lowTerrainFrames: number;
  zeroTerrainFrameThreshold: number;
  lowTerrainFrameThreshold: number;
  minRetainedTerrainFraction: number;
  minReferenceTerrainInstances: number;
}

interface TerrainVisibilityAnomalyResult {
  zeroTerrainFrames: number;
  lowTerrainFrames: number;
  shouldTriggerRecovery: boolean;
  recoveryReason: "zero" | "partial" | null;
}

interface ChunkVisibilityAnomalyInput {
  isCurrentChunkVisible: boolean;
  offscreenChunkFrames: number;
  offscreenChunkFrameThreshold: number;
}

interface ChunkVisibilityAnomalyResult {
  offscreenChunkFrames: number;
  shouldTriggerRecovery: boolean;
}

export function createWorldmapZoomHardeningConfig(
  input: WorldmapZoomHardeningConfigInput,
): WorldmapZoomHardeningConfig {
  const enabled = input.enabled === true;
  return {
    enabled,
    latestWinsRefresh: enabled,
    terrainSelfHeal: enabled,
    telemetry: enabled && input.telemetry === true,
  };
}

export function resetWorldmapZoomHardeningRuntimeState(
  input: WorldmapZoomHardeningRuntimeStateInput,
  clearPendingTimeout: (timeoutId: number) => void,
): WorldmapZoomHardeningRuntimeStateInput {
  if (input.chunkRefreshTimeout !== null) {
    clearPendingTimeout(input.chunkRefreshTimeout);
  }

  return {
    chunkRefreshTimeout: null,
    chunkRefreshRequestToken: 0,
    chunkRefreshAppliedToken: 0,
    chunkRefreshRunning: false,
    chunkRefreshRerunRequested: false,
    pendingChunkRefreshForce: false,
    zeroTerrainFrames: 0,
    terrainRecoveryInFlight: false,
  };
}

export function evaluateTerrainVisibilityAnomaly(input: TerrainVisibilityAnomalyInput): TerrainVisibilityAnomalyResult {
  const terrainInstances = Math.max(0, Math.floor(input.terrainInstances));
  const terrainReferenceInstances = Math.max(0, Math.floor(input.terrainReferenceInstances));
  const zeroTerrainFrameThreshold = Math.max(1, Math.floor(input.zeroTerrainFrameThreshold));
  const lowTerrainFrameThreshold = Math.max(1, Math.floor(input.lowTerrainFrameThreshold));
  const minReferenceTerrainInstances = Math.max(0, Math.floor(input.minReferenceTerrainInstances));
  const minRetainedTerrainFraction = Math.min(1, Math.max(0, input.minRetainedTerrainFraction));

  const nextZeroTerrainFrames = terrainInstances === 0 ? input.zeroTerrainFrames + 1 : 0;
  if (nextZeroTerrainFrames >= zeroTerrainFrameThreshold) {
    return {
      zeroTerrainFrames: nextZeroTerrainFrames,
      lowTerrainFrames: 0,
      shouldTriggerRecovery: true,
      recoveryReason: "zero",
    };
  }

  const canEvaluatePartialDrop =
    terrainReferenceInstances >= minReferenceTerrainInstances && terrainInstances > 0 && terrainReferenceInstances > 0;
  if (!canEvaluatePartialDrop) {
    return {
      zeroTerrainFrames: nextZeroTerrainFrames,
      lowTerrainFrames: 0,
      shouldTriggerRecovery: false,
      recoveryReason: null,
    };
  }

  const retainedFraction = terrainInstances / terrainReferenceInstances;
  const isLowTerrain = retainedFraction < minRetainedTerrainFraction;
  const nextLowTerrainFrames = isLowTerrain ? input.lowTerrainFrames + 1 : 0;
  if (nextLowTerrainFrames >= lowTerrainFrameThreshold) {
    return {
      zeroTerrainFrames: nextZeroTerrainFrames,
      lowTerrainFrames: nextLowTerrainFrames,
      shouldTriggerRecovery: true,
      recoveryReason: "partial",
    };
  }

  return {
    zeroTerrainFrames: nextZeroTerrainFrames,
    lowTerrainFrames: nextLowTerrainFrames,
    shouldTriggerRecovery: false,
    recoveryReason: null,
  };
}

export function evaluateChunkVisibilityAnomaly(input: ChunkVisibilityAnomalyInput): ChunkVisibilityAnomalyResult {
  if (input.isCurrentChunkVisible) {
    return {
      offscreenChunkFrames: 0,
      shouldTriggerRecovery: false,
    };
  }

  const offscreenChunkFrameThreshold = Math.max(1, Math.floor(input.offscreenChunkFrameThreshold));
  const nextOffscreenFrames = input.offscreenChunkFrames + 1;
  return {
    offscreenChunkFrames: nextOffscreenFrames,
    shouldTriggerRecovery: nextOffscreenFrames >= offscreenChunkFrameThreshold,
  };
}
