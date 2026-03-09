import { describe, expect, it } from "vitest";

import {
  buildTerrainRecoveryDebugEvent,
  buildWorldmapTerrainHealthState,
  type WorldmapTerrainHealthState,
} from "./worldmap-terrain-health";

describe("worldmap terrain health", () => {
  it("captures the current chunk terrain and fetch state in a debug snapshot", () => {
    const snapshot = buildWorldmapTerrainHealthState({
      currentChunk: "24,48",
      currentAreaKey: "area:24,48",
      toriiBoundsAreaKey: "area:24,48",
      nonZeroBiomeCount: 2,
      biomeInstanceCounts: { Grassland: 320, Scorched: 192 },
      totalTerrainInstances: 0,
      terrainReferenceInstances: 512,
      zeroTerrainFrames: 3,
      lowTerrainFrames: 1,
      offscreenChunkFrames: 0,
      pendingFetches: 2,
      fetchedAreaLoaded: false,
      criticalAreaLoaded: true,
      currentChunkVisible: true,
      hasCurrentChunkBounds: true,
      terrainRecoveryInFlight: false,
    });

    expect(snapshot).toEqual<WorldmapTerrainHealthState>({
      currentChunk: "24,48",
      currentAreaKey: "area:24,48",
      toriiBoundsAreaKey: "area:24,48",
      nonZeroBiomeCount: 2,
      biomeInstanceCounts: { Grassland: 320, Scorched: 192 },
      totalTerrainInstances: 0,
      terrainReferenceInstances: 512,
      zeroTerrainFrames: 3,
      lowTerrainFrames: 1,
      offscreenChunkFrames: 0,
      pendingFetches: 2,
      fetchedAreaLoaded: false,
      criticalAreaLoaded: true,
      currentChunkVisible: true,
      hasCurrentChunkBounds: true,
      terrainRecoveryInFlight: false,
    });
  });

  it("records recovery events with a stable timestamped snapshot", () => {
    const snapshot = buildWorldmapTerrainHealthState({
      currentChunk: "0,0",
      currentAreaKey: "area:0,0",
      toriiBoundsAreaKey: "area:24,0",
      nonZeroBiomeCount: 1,
      biomeInstanceCounts: { Grassland: 400 },
      totalTerrainInstances: 0,
      terrainReferenceInstances: 400,
      zeroTerrainFrames: 4,
      lowTerrainFrames: 0,
      offscreenChunkFrames: 2,
      pendingFetches: 1,
      fetchedAreaLoaded: true,
      criticalAreaLoaded: true,
      currentChunkVisible: false,
      hasCurrentChunkBounds: true,
      terrainRecoveryInFlight: true,
    });

    const event = buildTerrainRecoveryDebugEvent({
      reason: "offscreen",
      snapshot,
      recordedAtMs: 1234,
    });

    expect(event).toEqual({
      reason: "offscreen",
      recordedAtMs: 1234,
      snapshot,
    });
  });
});
