export type WorldmapTerrainRecoveryReason = "zero" | "partial" | "offscreen";

export interface WorldmapTerrainHealthState {
  currentChunk: string;
  currentAreaKey: string | null;
  toriiBoundsAreaKey: string | null;
  nonZeroBiomeCount: number;
  biomeInstanceCounts: Record<string, number>;
  biomeRenderStates?: Record<
    string,
    {
      anyMeshVisible: boolean;
      allMeshesVisible: boolean;
      anyMeshFrustumCulled: boolean;
      firstInstancePosition?: { x: number; y: number; z: number } | null;
      firstInstanceInsideCurrentBounds?: boolean | null;
    }
  >;
  totalTerrainInstances: number;
  terrainReferenceInstances: number;
  zeroTerrainFrames: number;
  lowTerrainFrames: number;
  offscreenChunkFrames: number;
  pendingFetches: number;
  fetchedAreaLoaded: boolean;
  criticalAreaLoaded: boolean;
  currentChunkVisible: boolean | null;
  hasCurrentChunkBounds: boolean;
  terrainRecoveryInFlight: boolean;
}

export interface WorldmapTerrainRecoveryDebugEvent {
  reason: WorldmapTerrainRecoveryReason;
  recordedAtMs: number;
  snapshot: WorldmapTerrainHealthState;
}

interface BuildTerrainRecoveryDebugEventInput {
  reason: WorldmapTerrainRecoveryReason;
  recordedAtMs: number;
  snapshot: WorldmapTerrainHealthState;
}

export function buildWorldmapTerrainHealthState(input: WorldmapTerrainHealthState): WorldmapTerrainHealthState {
  return { ...input };
}

export function buildTerrainRecoveryDebugEvent(
  input: BuildTerrainRecoveryDebugEventInput,
): WorldmapTerrainRecoveryDebugEvent {
  return {
    reason: input.reason,
    recordedAtMs: input.recordedAtMs,
    snapshot: buildWorldmapTerrainHealthState(input.snapshot),
  };
}
