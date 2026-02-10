export interface WorldmapZoomHardeningConfigInput {
  enabled: boolean;
  telemetry: boolean;
}

export interface WorldmapZoomHardeningConfig {
  enabled: boolean;
  latestWinsRefresh: boolean;
  terrainSelfHeal: boolean;
  telemetry: boolean;
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
