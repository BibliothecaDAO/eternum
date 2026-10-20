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
