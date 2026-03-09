import { describe, expect, it } from "vitest";

import {
  evaluateWorldmapTerrainCandidate,
  isTerrainCacheCompatible,
  resolveWorldmapTerrainFetchState,
  resolveWorldmapTerrainReconcileRequest,
  type WorldmapTerrainSnapshot,
} from "./worldmap-terrain-convergence";

function createSnapshot(overrides: Partial<WorldmapTerrainSnapshot> = {}): WorldmapTerrainSnapshot {
  return {
    chunkKey: "24,24",
    areaKey: "area:24,24",
    startRow: 24,
    startCol: 24,
    rows: 48,
    cols: 48,
    transitionToken: 7,
    terrainRevision: 3,
    source: "critical_fetch",
    totalInstances: 512,
    referenceInstances: 512,
    biomeCounts: { Grassland: 512 },
    fetchedAreaLoaded: true,
    criticalAreaLoaded: true,
    builtAtMs: 1234,
    ...overrides,
  };
}

describe("resolveWorldmapTerrainFetchState", () => {
  it("tracks critical fetch completion by chunk key while area hydration stays area-scoped", () => {
    expect(
      resolveWorldmapTerrainFetchState({
        areaKey: "0,0",
        chunkKey: "24,24",
        fetchedAreaKeys: new Set(["0,0"]),
        fetchedCriticalChunkKeys: new Set(["24,24"]),
      }),
    ).toEqual({
      fetchedAreaLoaded: true,
      criticalAreaLoaded: true,
    });
  });

  it("does not treat area-scoped background fetch state as critical chunk hydration", () => {
    expect(
      resolveWorldmapTerrainFetchState({
        areaKey: "0,0",
        chunkKey: "24,24",
        fetchedAreaKeys: new Set(["0,0"]),
        fetchedCriticalChunkKeys: new Set(["0,0"]),
      }),
    ).toEqual({
      fetchedAreaLoaded: true,
      criticalAreaLoaded: false,
    });
  });
});

describe("evaluateWorldmapTerrainCandidate", () => {
  it("rejects blank candidates when the active terrain is still valid", () => {
    const activeSnapshot = createSnapshot();
    const candidateSnapshot = createSnapshot({
      totalInstances: 0,
      biomeCounts: {},
    });

    expect(
      evaluateWorldmapTerrainCandidate({
        activeSnapshot,
        candidateSnapshot,
        expectedChunkKey: "24,24",
        expectedAreaKey: "area:24,24",
        latestTransitionToken: 7,
        latestTerrainRevision: 3,
        expectedVisibleTerrainInstances: 512,
        isSpectating: false,
        minRetainedTerrainFraction: 0.45,
        minReferenceTerrainInstances: 100,
        minSpectatorCoverageFraction: 0.85,
        minExpectedSpectatorInstances: 128,
      }),
    ).toEqual({
      shouldPromote: false,
      rejectReason: "blank_regression",
    });
  });

  it("allows legitimate empty windows when there is no expected visible terrain", () => {
    const candidateSnapshot = createSnapshot({
      totalInstances: 0,
      referenceInstances: 0,
      biomeCounts: {},
    });

    expect(
      evaluateWorldmapTerrainCandidate({
        activeSnapshot: null,
        candidateSnapshot,
        expectedChunkKey: "24,24",
        expectedAreaKey: "area:24,24",
        latestTransitionToken: 7,
        latestTerrainRevision: 3,
        expectedVisibleTerrainInstances: 0,
        isSpectating: false,
        minRetainedTerrainFraction: 0.45,
        minReferenceTerrainInstances: 100,
        minSpectatorCoverageFraction: 0.85,
        minExpectedSpectatorInstances: 128,
      }),
    ).toEqual({
      shouldPromote: true,
      rejectReason: null,
    });
  });

  it("drops stale transition and revision candidates before promotion", () => {
    const staleTransition = evaluateWorldmapTerrainCandidate({
      activeSnapshot: createSnapshot(),
      candidateSnapshot: createSnapshot({ transitionToken: 6 }),
      expectedChunkKey: "24,24",
      expectedAreaKey: "area:24,24",
      latestTransitionToken: 7,
      latestTerrainRevision: 3,
      expectedVisibleTerrainInstances: 512,
      isSpectating: false,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
      minSpectatorCoverageFraction: 0.85,
      minExpectedSpectatorInstances: 128,
    });
    const staleRevision = evaluateWorldmapTerrainCandidate({
      activeSnapshot: createSnapshot(),
      candidateSnapshot: createSnapshot({ terrainRevision: 2 }),
      expectedChunkKey: "24,24",
      expectedAreaKey: "area:24,24",
      latestTransitionToken: 7,
      latestTerrainRevision: 3,
      expectedVisibleTerrainInstances: 512,
      isSpectating: false,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
      minSpectatorCoverageFraction: 0.85,
      minExpectedSpectatorInstances: 128,
    });

    expect(staleTransition).toEqual({
      shouldPromote: false,
      rejectReason: "stale_transition",
    });
    expect(staleRevision).toEqual({
      shouldPromote: false,
      rejectReason: "stale_revision",
    });
  });
});

describe("isTerrainCacheCompatible", () => {
  it("rejects cache replay when the revision lineage changed", () => {
    expect(
      isTerrainCacheCompatible({
        cacheAreaKey: "area:24,24",
        targetAreaKey: "area:24,24",
        cacheTerrainRevision: 2,
        latestTerrainRevision: 3,
      }),
    ).toBe(false);
  });

  it("accepts cache replay when area and revision still match", () => {
    expect(
      isTerrainCacheCompatible({
        cacheAreaKey: "area:24,24",
        targetAreaKey: "area:24,24",
        cacheTerrainRevision: 3,
        latestTerrainRevision: 3,
      }),
    ).toBe(true);
  });
});

describe("resolveWorldmapTerrainReconcileRequest", () => {
  it("keeps only the latest reconcile request", () => {
    const currentRequest = {
      chunkKey: "24,24",
      areaKey: "area:24,24",
      transitionToken: 7,
      terrainRevisionAtFetchStart: 1,
      terrainRevisionAtFetchComplete: 2,
      priority: "background" as const,
    };
    const nextRequest = {
      ...currentRequest,
      transitionToken: 8,
      terrainRevisionAtFetchComplete: 3,
      priority: "critical" as const,
    };

    expect(
      resolveWorldmapTerrainReconcileRequest({
        currentRequest,
        nextRequest,
      }),
    ).toEqual({
      activeRequest: nextRequest,
      droppedCurrentRequest: true,
    });
  });
});
