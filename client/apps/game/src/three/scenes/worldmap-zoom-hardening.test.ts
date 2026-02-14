import { describe, expect, it } from "vitest";
import { createWorldmapZoomHardeningConfig, resetWorldmapZoomHardeningRuntimeState } from "./worldmap-zoom-hardening";

describe("createWorldmapZoomHardeningConfig", () => {
  it("disables all hardening behavior when master flag is off", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: false,
      telemetry: true,
    });

    expect(config.enabled).toBe(false);
    expect(config.latestWinsRefresh).toBe(false);
    expect(config.terrainSelfHeal).toBe(false);
    expect(config.telemetry).toBe(false);
  });

  it("enables hardening behavior without telemetry by default", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: true,
      telemetry: false,
    });

    expect(config.enabled).toBe(true);
    expect(config.latestWinsRefresh).toBe(true);
    expect(config.terrainSelfHeal).toBe(true);
    expect(config.telemetry).toBe(false);
  });

  it("enables telemetry only when hardening is enabled", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: true,
      telemetry: true,
    });

    expect(config.enabled).toBe(true);
    expect(config.latestWinsRefresh).toBe(true);
    expect(config.terrainSelfHeal).toBe(true);
    expect(config.telemetry).toBe(true);
  });
});

describe("resetWorldmapZoomHardeningRuntimeState", () => {
  it("clears pending refresh timeout and resets runtime flags", () => {
    const clearedTimers: number[] = [];
    const reset = resetWorldmapZoomHardeningRuntimeState(
      {
        chunkRefreshTimeout: 77,
        chunkRefreshRequestToken: 3,
        chunkRefreshAppliedToken: 2,
        chunkRefreshRunning: true,
        chunkRefreshRerunRequested: true,
        pendingChunkRefreshForce: true,
        zeroTerrainFrames: 6,
        terrainRecoveryInFlight: true,
      },
      (timeoutId) => {
        clearedTimers.push(timeoutId);
      },
    );

    expect(clearedTimers).toEqual([77]);
    expect(reset).toEqual({
      chunkRefreshTimeout: null,
      chunkRefreshRequestToken: 0,
      chunkRefreshAppliedToken: 0,
      chunkRefreshRunning: false,
      chunkRefreshRerunRequested: false,
      pendingChunkRefreshForce: false,
      zeroTerrainFrames: 0,
      terrainRecoveryInFlight: false,
    });
  });

  it("does not call clearTimeout when no timer is pending", () => {
    const clearedTimers: number[] = [];
    const reset = resetWorldmapZoomHardeningRuntimeState(
      {
        chunkRefreshTimeout: null,
        chunkRefreshRequestToken: 1,
        chunkRefreshAppliedToken: 1,
        chunkRefreshRunning: false,
        chunkRefreshRerunRequested: false,
        pendingChunkRefreshForce: false,
        zeroTerrainFrames: 0,
        terrainRecoveryInFlight: false,
      },
      (timeoutId) => {
        clearedTimers.push(timeoutId);
      },
    );

    expect(clearedTimers).toEqual([]);
    expect(reset.chunkRefreshTimeout).toBeNull();
    expect(reset.chunkRefreshRequestToken).toBe(0);
  });
});
