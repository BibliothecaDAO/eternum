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
