import { describe, expect, it } from "vitest";

import {
  WORLDMAP_BACKGROUND_REFRESH_WATCHDOG_TIMEOUT_MS,
  WORLDMAP_BLOCKING_SWITCH_WATCHDOG_TIMEOUT_MS,
  WORLDMAP_EXACT_TILE_FETCH_TIMEOUT_MS,
  WORLDMAP_HYDRATION_IDLE_TIMEOUT_MS,
  applyBackgroundRefreshTimeoutState,
  applyBlockingSwitchTimeoutState,
  shouldRecordCompletedBackgroundRefresh,
  shouldDropBackgroundRefreshWork,
} from "./worldmap-chunk-work-watchdog";

describe("worldmap chunk work watchdog", () => {
  it("exports the stabilization timeout defaults", () => {
    expect(WORLDMAP_EXACT_TILE_FETCH_TIMEOUT_MS).toBe(8_000);
    expect(WORLDMAP_HYDRATION_IDLE_TIMEOUT_MS).toBe(4_000);
    expect(WORLDMAP_BACKGROUND_REFRESH_WATCHDOG_TIMEOUT_MS).toBe(10_000);
    expect(WORLDMAP_BLOCKING_SWITCH_WATCHDOG_TIMEOUT_MS).toBe(12_000);
  });

  it("clears the active background refresh lane when the latest refresh times out", () => {
    const promise = Promise.resolve();

    expect(
      applyBackgroundRefreshTimeoutState({
        timedOutRefreshToken: 7,
        currentChunkRefreshToken: 7,
        currentChunkRefreshPromise: promise,
        currentChunkRefreshStartedAtMs: 123,
        currentChunkRefreshReason: "hydrated_chunk",
        currentChunkRefreshTargetChunk: "24,24",
      }),
    ).toEqual({
      currentChunkRefreshToken: 8,
      currentChunkRefreshPromise: null,
      currentChunkRefreshStartedAtMs: null,
      currentChunkRefreshReason: null,
      currentChunkRefreshTargetChunk: null,
      didTimeoutLatestRefresh: true,
    });
  });

  it("leaves the background refresh lane intact when an older timeout fires late", () => {
    const promise = Promise.resolve();

    expect(
      applyBackgroundRefreshTimeoutState({
        timedOutRefreshToken: 6,
        currentChunkRefreshToken: 7,
        currentChunkRefreshPromise: promise,
        currentChunkRefreshStartedAtMs: 123,
        currentChunkRefreshReason: "hydrated_chunk",
        currentChunkRefreshTargetChunk: "24,24",
      }),
    ).toEqual({
      currentChunkRefreshToken: 7,
      currentChunkRefreshPromise: promise,
      currentChunkRefreshStartedAtMs: 123,
      currentChunkRefreshReason: "hydrated_chunk",
      currentChunkRefreshTargetChunk: "24,24",
      didTimeoutLatestRefresh: false,
    });
  });

  it("clears blocking switch authority and invalidates stale work when the active switch times out", () => {
    const promise = Promise.resolve();

    expect(
      applyBlockingSwitchTimeoutState({
        timedOutTransitionToken: 11,
        chunkTransitionToken: 11,
        pendingChunkFetchGeneration: 4,
        globalChunkSwitchPromise: promise,
        isChunkTransitioning: true,
        shouldRetryBlockingSwitchOnNextControlsChange: false,
      }),
    ).toEqual({
      chunkTransitionToken: 12,
      pendingChunkFetchGeneration: 5,
      globalChunkSwitchPromise: null,
      isChunkTransitioning: false,
      shouldRetryBlockingSwitchOnNextControlsChange: true,
      didTimeoutLatestBlockingSwitch: true,
    });
  });

  it("drops background refresh work for stale token, chunk drift, or switched-off scene", () => {
    expect(
      shouldDropBackgroundRefreshWork({
        refreshToken: 4,
        currentRefreshToken: 5,
        currentChunk: "24,24",
        targetChunk: "24,24",
        isSwitchedOff: false,
      }),
    ).toBe(true);

    expect(
      shouldDropBackgroundRefreshWork({
        refreshToken: 5,
        currentRefreshToken: 5,
        currentChunk: "48,24",
        targetChunk: "24,24",
        isSwitchedOff: false,
      }),
    ).toBe(true);

    expect(
      shouldDropBackgroundRefreshWork({
        refreshToken: 5,
        currentRefreshToken: 5,
        currentChunk: "24,24",
        targetChunk: "24,24",
        isSwitchedOff: true,
      }),
    ).toBe(true);

    expect(
      shouldDropBackgroundRefreshWork({
        refreshToken: 5,
        currentRefreshToken: 5,
        currentChunk: "24,24",
        targetChunk: "24,24",
        isSwitchedOff: false,
      }),
    ).toBe(false);
  });

  it("records completion only for refreshes that actually finish", () => {
    expect(shouldRecordCompletedBackgroundRefresh("completed")).toBe(true);
    expect(shouldRecordCompletedBackgroundRefresh("stale_dropped")).toBe(false);
    expect(shouldRecordCompletedBackgroundRefresh("timed_out")).toBe(false);
  });
});
