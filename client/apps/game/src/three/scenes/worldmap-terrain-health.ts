import type { WorldmapTerrainCandidateRejectReason, WorldmapTerrainSnapshot } from "./worldmap-terrain-convergence";

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
  activeTerrainSnapshot?: WorldmapTerrainSnapshot | null;
  candidateTerrainSnapshot?: WorldmapTerrainSnapshot | null;
  lastTerrainCandidateRejectReason?: WorldmapTerrainCandidateRejectReason | null;
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
  return {
    ...input,
    activeTerrainSnapshot: input.activeTerrainSnapshot ?? null,
    candidateTerrainSnapshot: input.candidateTerrainSnapshot ?? null,
    lastTerrainCandidateRejectReason: input.lastTerrainCandidateRejectReason ?? null,
  };
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
