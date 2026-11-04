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
