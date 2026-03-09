export type WorldmapTerrainSnapshotSource = "cache" | "strip" | "critical_fetch" | "background_fetch" | "stream";

export interface WorldmapTerrainSnapshot {
  chunkKey: string;
  areaKey: string;
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
  transitionToken: number;
  terrainRevision: number;
  source: WorldmapTerrainSnapshotSource;
  totalInstances: number;
  referenceInstances: number;
  biomeCounts: Record<string, number>;
  fetchedAreaLoaded: boolean;
  criticalAreaLoaded: boolean;
  builtAtMs: number;
}

export type WorldmapTerrainCandidateRejectReason =
  | "stale_transition"
  | "stale_revision"
  | "mismatched_target"
  | "blank_regression"
  | "partial_regression"
  | "spectator_underfill";

interface EvaluateWorldmapTerrainCandidateInput {
  activeSnapshot: WorldmapTerrainSnapshot | null;
  candidateSnapshot: WorldmapTerrainSnapshot;
  expectedChunkKey: string;
  expectedAreaKey: string;
  latestTransitionToken: number;
  latestTerrainRevision: number;
  expectedVisibleTerrainInstances: number;
  isSpectating: boolean;
  minRetainedTerrainFraction: number;
  minReferenceTerrainInstances: number;
  minSpectatorCoverageFraction: number;
  minExpectedSpectatorInstances: number;
}

interface EvaluateWorldmapTerrainCandidateResult {
  shouldPromote: boolean;
  rejectReason: WorldmapTerrainCandidateRejectReason | null;
}

interface TerrainCacheCompatibilityInput {
  cacheAreaKey: string;
  targetAreaKey: string;
  cacheTerrainRevision: number;
  latestTerrainRevision: number;
}

export interface WorldmapTerrainReconcileRequest {
  chunkKey: string;
  areaKey: string;
  transitionToken: number;
  terrainRevisionAtFetchStart: number;
  terrainRevisionAtFetchComplete: number;
  priority: "critical" | "background";
}

interface ResolveWorldmapTerrainReconcileRequestInput {
  currentRequest: WorldmapTerrainReconcileRequest | null;
  nextRequest: WorldmapTerrainReconcileRequest;
}

interface ResolveWorldmapTerrainReconcileRequestResult {
  activeRequest: WorldmapTerrainReconcileRequest;
  droppedCurrentRequest: boolean;
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeCount(value: number): number {
  return Math.max(0, Math.floor(value));
}

function getReferenceTerrainInstances(
  activeSnapshot: WorldmapTerrainSnapshot | null,
  candidateSnapshot: WorldmapTerrainSnapshot,
): number {
  return Math.max(
    normalizeCount(activeSnapshot?.referenceInstances ?? 0),
    normalizeCount(activeSnapshot?.totalInstances ?? 0),
    normalizeCount(candidateSnapshot.referenceInstances),
  );
}

export function evaluateWorldmapTerrainCandidate(
  input: EvaluateWorldmapTerrainCandidateInput,
): EvaluateWorldmapTerrainCandidateResult {
  const candidateTotalInstances = normalizeCount(input.candidateSnapshot.totalInstances);
  const expectedVisibleTerrainInstances = normalizeCount(input.expectedVisibleTerrainInstances);

  if (input.candidateSnapshot.transitionToken !== input.latestTransitionToken) {
    return {
      shouldPromote: false,
      rejectReason: "stale_transition",
    };
  }

  if (
    input.candidateSnapshot.chunkKey !== input.expectedChunkKey ||
    input.candidateSnapshot.areaKey !== input.expectedAreaKey
  ) {
    return {
      shouldPromote: false,
      rejectReason: "mismatched_target",
    };
  }

  if (input.candidateSnapshot.terrainRevision !== input.latestTerrainRevision) {
    return {
      shouldPromote: false,
      rejectReason: "stale_revision",
    };
  }

  if (expectedVisibleTerrainInstances === 0) {
    return {
      shouldPromote: true,
      rejectReason: null,
    };
  }

  if (normalizeCount(input.activeSnapshot?.totalInstances ?? 0) > 0 && candidateTotalInstances === 0) {
    return {
      shouldPromote: false,
      rejectReason: "blank_regression",
    };
  }

  const referenceTerrainInstances = getReferenceTerrainInstances(input.activeSnapshot, input.candidateSnapshot);
  if (referenceTerrainInstances >= normalizeCount(input.minReferenceTerrainInstances)) {
    const minRetainedTerrainFraction = clampFraction(input.minRetainedTerrainFraction);
    const minRetainedTerrainInstances = Math.ceil(referenceTerrainInstances * minRetainedTerrainFraction);
    if (candidateTotalInstances < minRetainedTerrainInstances) {
      return {
        shouldPromote: false,
        rejectReason: "partial_regression",
      };
    }
  }

  if (input.isSpectating && referenceTerrainInstances >= normalizeCount(input.minExpectedSpectatorInstances)) {
    const minSpectatorCoverageFraction = clampFraction(input.minSpectatorCoverageFraction);
    const minSpectatorTerrainInstances = Math.ceil(referenceTerrainInstances * minSpectatorCoverageFraction);
    if (candidateTotalInstances < minSpectatorTerrainInstances) {
      return {
        shouldPromote: false,
        rejectReason: "spectator_underfill",
      };
    }
  }

  return {
    shouldPromote: true,
    rejectReason: null,
  };
}

export function isTerrainCacheCompatible(input: TerrainCacheCompatibilityInput): boolean {
  return input.cacheAreaKey === input.targetAreaKey && input.cacheTerrainRevision === input.latestTerrainRevision;
}

function compareTerrainReconcilePriority(
  left: WorldmapTerrainReconcileRequest,
  right: WorldmapTerrainReconcileRequest,
): number {
  if (left.transitionToken !== right.transitionToken) {
    return left.transitionToken - right.transitionToken;
  }

  if (left.terrainRevisionAtFetchComplete !== right.terrainRevisionAtFetchComplete) {
    return left.terrainRevisionAtFetchComplete - right.terrainRevisionAtFetchComplete;
  }

  if (left.priority === right.priority) {
    return 0;
  }

  return left.priority === "critical" ? 1 : -1;
}

export function resolveWorldmapTerrainReconcileRequest(
  input: ResolveWorldmapTerrainReconcileRequestInput,
): ResolveWorldmapTerrainReconcileRequestResult {
  const currentRequest = input.currentRequest;
  if (!currentRequest) {
    return {
      activeRequest: input.nextRequest,
      droppedCurrentRequest: false,
    };
  }

  if (compareTerrainReconcilePriority(input.nextRequest, currentRequest) >= 0) {
    return {
      activeRequest: input.nextRequest,
      droppedCurrentRequest: true,
    };
  }

  return {
    activeRequest: currentRequest,
    droppedCurrentRequest: false,
  };
}
