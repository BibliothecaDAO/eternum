import { describe, expect, it } from "vitest";
import {
  resolveWorldmapChunkRefreshDebounceMs,
  resolveWorldmapChunkRefreshSchedule,
  shouldDelayWorldmapChunkSwitch,
} from "./worldmap-chunk-switch-delay-policy";

describe("shouldDelayWorldmapChunkSwitch", () => {
  const baseInput = {
    cameraPosition: { x: 100, z: 100 },
    lastChunkSwitchPosition: { x: 95, z: 96 },
    chunkSize: 24,
    hexSize: 1,
    chunkSwitchPadding: 0.25,
  };

  it("does not delay when chunk switch anchor is missing", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: false,
      }),
    ).toBe(false);
  });

  it("does not delay when last chunk switch position is unavailable", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
        lastChunkSwitchPosition: undefined,
      }),
    ).toBe(false);
  });

  it("delays when camera remains inside padding bounds on both axes", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
      }),
    ).toBe(true);
  });

  it("does not delay when camera reaches the exact x-threshold", () => {
    const chunkWorldWidth = baseInput.chunkSize * baseInput.hexSize * Math.sqrt(3);
    const xThreshold = baseInput.lastChunkSwitchPosition.x + chunkWorldWidth * baseInput.chunkSwitchPadding;

    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
        cameraPosition: { x: xThreshold, z: baseInput.cameraPosition.z },
      }),
    ).toBe(false);
  });

  it("uses a lower debounce for traversal refreshes than generic forced refreshes", () => {
    const traversalDelayMs = resolveWorldmapChunkRefreshDebounceMs({
      force: false,
      reason: "default",
    });
    const forcedDelayMs = resolveWorldmapChunkRefreshDebounceMs({
      force: true,
      reason: "duplicate_tile",
    });

    expect(traversalDelayMs).toBeLessThan(forcedDelayMs);
  });

  it("reschedules only when a newly requested refresh deadline is earlier", () => {
    const keepExisting = resolveWorldmapChunkRefreshSchedule({
      existingDeadlineAtMs: 140,
      nowMs: 100,
      requestedDelayMs: 60,
    });
    const bringForward = resolveWorldmapChunkRefreshSchedule({
      existingDeadlineAtMs: 180,
      nowMs: 100,
      requestedDelayMs: 20,
    });

    expect(keepExisting).toEqual({
      shouldScheduleTimer: false,
      delayMs: 40,
      deadlineAtMs: 140,
    });
    expect(bringForward).toEqual({
      shouldScheduleTimer: true,
      delayMs: 20,
      deadlineAtMs: 120,
    });
  });
});
