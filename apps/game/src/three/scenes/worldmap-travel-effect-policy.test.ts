import { describe, expect, it } from "vitest";
import {
  resolveExploreCompletionVisualCleanup,
  shouldCleanupTrackedTravelEffect,
} from "./worldmap-travel-effect-policy";

describe("resolveExploreCompletionVisualCleanup", () => {
  it("returns pending compass effect entities for the explored tile", () => {
    const plan = resolveExploreCompletionVisualCleanup({
      activeMovementVisuals: new Set([1, 2, 3]),
      exploredHexKey: "10,20",
      trackedEffectsByEntity: new Map([
        [1, { key: "10,20", effectType: "compass" }],
        [2, { key: "10,20", effectType: "travel" }],
        [3, { key: "11,20", effectType: "compass" }],
      ]),
    });

    expect(plan).toEqual([1]);
  });

  it("ignores compass effects that are not pending", () => {
    const plan = resolveExploreCompletionVisualCleanup({
      activeMovementVisuals: new Set([8]),
      exploredHexKey: "4,5",
      trackedEffectsByEntity: new Map([
        [7, { key: "4,5", effectType: "compass" }],
        [8, { key: "4,5", effectType: "compass" }],
      ]),
    });

    expect(plan).toEqual([8]);
  });

  it("returns an empty list when no tracked effect matches", () => {
    const plan = resolveExploreCompletionVisualCleanup({
      activeMovementVisuals: new Set([5]),
      exploredHexKey: "1,1",
      trackedEffectsByEntity: new Map([[5, { key: "2,2", effectType: "compass" }]]),
    });

    expect(plan).toEqual([]);
  });

  it("preserves travel effects when pending movement clears because movement started", () => {
    expect(
      shouldCleanupTrackedTravelEffect({
        trackedEffect: { key: "7,8", effectType: "travel" },
        reason: "movement_started",
      }),
    ).toBe(false);
  });

  it("cleans up compass effects when pending movement clears because exploration resolved", () => {
    expect(
      shouldCleanupTrackedTravelEffect({
        trackedEffect: { key: "7,8", effectType: "compass" },
        reason: "movement_started",
      }),
    ).toBe(true);
  });

  it("cleans up tracked effects when pending movement is force-cleared", () => {
    expect(
      shouldCleanupTrackedTravelEffect({
        trackedEffect: { key: "7,8", effectType: "travel" },
        reason: "cleanup_requested",
      }),
    ).toBe(true);
  });
});
