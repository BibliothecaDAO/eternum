import { describe, expect, it } from "vitest";
import {
  createWorldmapZoomHardeningConfig,
  evaluateChunkVisibilityAnomaly,
  evaluateTerrainVisibilityAnomaly,
  resetWorldmapZoomHardeningRuntimeState,
} from "./worldmap-zoom-hardening";

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

describe("evaluateTerrainVisibilityAnomaly", () => {
  it("flags sustained zero-terrain anomalies after threshold frames", () => {
    const threshold = 4;
    let zeroTerrainFrames = 0;

    for (let i = 0; i < threshold - 1; i += 1) {
      const result = evaluateTerrainVisibilityAnomaly({
        terrainInstances: 0,
        terrainReferenceInstances: 500,
        zeroTerrainFrames,
        lowTerrainFrames: 0,
        zeroTerrainFrameThreshold: threshold,
        lowTerrainFrameThreshold: threshold,
        minRetainedTerrainFraction: 0.45,
        minReferenceTerrainInstances: 100,
      });
      zeroTerrainFrames = result.zeroTerrainFrames;
      expect(result.shouldTriggerRecovery).toBe(false);
      expect(result.recoveryReason).toBeNull();
    }

    const final = evaluateTerrainVisibilityAnomaly({
      terrainInstances: 0,
      terrainReferenceInstances: 500,
      zeroTerrainFrames,
      lowTerrainFrames: 0,
      zeroTerrainFrameThreshold: threshold,
      lowTerrainFrameThreshold: threshold,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
    });

    expect(final.shouldTriggerRecovery).toBe(true);
    expect(final.recoveryReason).toBe("zero");
  });

  it("flags sustained partial-terrain collapse against a stable reference", () => {
    const threshold = 3;
    let lowTerrainFrames = 0;

    for (let i = 0; i < threshold - 1; i += 1) {
      const result = evaluateTerrainVisibilityAnomaly({
        terrainInstances: 120,
        terrainReferenceInstances: 500,
        zeroTerrainFrames: 0,
        lowTerrainFrames,
        zeroTerrainFrameThreshold: 5,
        lowTerrainFrameThreshold: threshold,
        minRetainedTerrainFraction: 0.45,
        minReferenceTerrainInstances: 100,
      });
      lowTerrainFrames = result.lowTerrainFrames;
      expect(result.shouldTriggerRecovery).toBe(false);
      expect(result.recoveryReason).toBeNull();
    }

    const final = evaluateTerrainVisibilityAnomaly({
      terrainInstances: 120,
      terrainReferenceInstances: 500,
      zeroTerrainFrames: 0,
      lowTerrainFrames,
      zeroTerrainFrameThreshold: 5,
      lowTerrainFrameThreshold: threshold,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
    });

    expect(final.shouldTriggerRecovery).toBe(true);
    expect(final.recoveryReason).toBe("partial");
  });

  it("does not flag partial collapse when reference terrain is too small", () => {
    const result = evaluateTerrainVisibilityAnomaly({
      terrainInstances: 20,
      terrainReferenceInstances: 40,
      zeroTerrainFrames: 0,
      lowTerrainFrames: 2,
      zeroTerrainFrameThreshold: 4,
      lowTerrainFrameThreshold: 4,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
    });

    expect(result.shouldTriggerRecovery).toBe(false);
    expect(result.recoveryReason).toBeNull();
    expect(result.lowTerrainFrames).toBe(0);
  });
});

describe("evaluateChunkVisibilityAnomaly", () => {
  it("resets the offscreen counter when current chunk is visible", () => {
    const result = evaluateChunkVisibilityAnomaly({
      isCurrentChunkVisible: true,
      offscreenChunkFrames: 9,
      offscreenChunkFrameThreshold: 4,
    });

    expect(result.offscreenChunkFrames).toBe(0);
    expect(result.shouldTriggerRecovery).toBe(false);
  });

  it("triggers recovery only after sustained offscreen frames", () => {
    const threshold = 3;
    let offscreenChunkFrames = 0;

    for (let i = 0; i < threshold - 1; i += 1) {
      const result = evaluateChunkVisibilityAnomaly({
        isCurrentChunkVisible: false,
        offscreenChunkFrames,
        offscreenChunkFrameThreshold: threshold,
      });
      offscreenChunkFrames = result.offscreenChunkFrames;
      expect(result.shouldTriggerRecovery).toBe(false);
    }

    const final = evaluateChunkVisibilityAnomaly({
      isCurrentChunkVisible: false,
      offscreenChunkFrames,
      offscreenChunkFrameThreshold: threshold,
    });

    expect(final.offscreenChunkFrames).toBe(threshold);
    expect(final.shouldTriggerRecovery).toBe(true);
  });

  it("does not trigger offscreen recovery while current padded terrain bounds remain visible", () => {
    // When the current chunk IS visible (e.g. padded terrain bounds include it),
    // recovery must not trigger regardless of accumulated offscreen frames.
    const result = evaluateChunkVisibilityAnomaly({
      isCurrentChunkVisible: true,
      offscreenChunkFrames: 100, // high accumulated count
      offscreenChunkFrameThreshold: 3,
    });

    expect(result.offscreenChunkFrames).toBe(0);
    expect(result.shouldTriggerRecovery).toBe(false);
  });
});

describe("terrain recovery requires sustained evidence, not instantaneous bounds", () => {
  it("does not trigger terrain self-heal when terrain counts are stable but coarse bounds disagree", () => {
    // Scenario: terrain instance count is healthy relative to reference,
    // so even if hypothetical coarse bounds might suggest something is wrong,
    // the frame-based anomaly detector should NOT trigger recovery.
    const result = evaluateTerrainVisibilityAnomaly({
      terrainInstances: 450, // healthy count
      terrainReferenceInstances: 500, // close to current
      zeroTerrainFrames: 0,
      lowTerrainFrames: 0,
      zeroTerrainFrameThreshold: 4,
      lowTerrainFrameThreshold: 4,
      minRetainedTerrainFraction: 0.45,
      minReferenceTerrainInstances: 100,
    });

    expect(result.shouldTriggerRecovery).toBe(false);
    expect(result.recoveryReason).toBeNull();
    expect(result.zeroTerrainFrames).toBe(0);
    expect(result.lowTerrainFrames).toBe(0);
  });
});
