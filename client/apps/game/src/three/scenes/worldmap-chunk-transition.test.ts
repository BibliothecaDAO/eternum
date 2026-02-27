import { describe, expect, it } from "vitest";
import { getRenderBounds } from "../utils/chunk-geometry";
import {
  resolveDuplicateTileReconcilePlan,
  resolveRefreshCompletionActions,
  resolveDuplicateTileUpdateMode,
  resolveDuplicateTileUpdateActions,
  resolveRefreshExecutionPlan,
  resolveRefreshRunningActions,
  shouldRequestTileRefreshForStructureBoundsChange,
  shouldForceShortcutNavigationRefresh,
  shouldForceRefreshForDuplicateTileUpdate,
  shouldRunShortcutForceFallback,
  resolveRefreshExecutionToken,
  resolveChunkSwitchActions,
  shouldApplyRefreshToken,
  shouldAcceptExactTransitionToken,
  shouldRescheduleRefreshToken,
  shouldRunManagerUpdate,
  shouldRunImmediateDuplicateTileRefresh,
  waitForChunkTransitionToSettle,
  resolveHydratedChunkRefreshFlushPlan,
  shouldScheduleHydratedChunkRefreshForFetch,
  shouldForceChunkRefreshForZoomDistanceChange,
  resolveControlsChangeChunkRefreshPlan,
  resolveEntityActionPathLookup,
} from "./worldmap-chunk-transition";

describe("resolveChunkSwitchActions", () => {
  it("rolls back when fetch failed and transition is still current", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: false,
        isCurrentTransition: true,
        targetChunk: "24,24",
        previousChunk: "0,0",
      }),
    ).toEqual({
      shouldRollback: true,
      shouldCommitManagers: false,
      shouldUnregisterPreviousChunk: false,
      shouldRestorePreviousState: true,
    });
  });

  it("commits and unregisters previous chunk on successful switch", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: true,
        isCurrentTransition: true,
        targetChunk: "24,24",
        previousChunk: "0,0",
      }),
    ).toEqual({
      shouldRollback: false,
      shouldCommitManagers: true,
      shouldUnregisterPreviousChunk: true,
      shouldRestorePreviousState: false,
    });
  });

  it("ignores stale transitions when transition token is no longer current", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: true,
        isCurrentTransition: false,
        targetChunk: "24,24",
        previousChunk: "0,0",
      }),
    ).toEqual({
      shouldRollback: false,
      shouldCommitManagers: false,
      shouldUnregisterPreviousChunk: false,
      shouldRestorePreviousState: false,
    });
  });

  it("does not unregister when previous chunk equals target", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: true,
        isCurrentTransition: true,
        targetChunk: "24,24",
        previousChunk: "24,24",
      }),
    ).toEqual({
      shouldRollback: false,
      shouldCommitManagers: true,
      shouldUnregisterPreviousChunk: false,
      shouldRestorePreviousState: false,
    });
  });
});

describe("shouldRunManagerUpdate", () => {
  it("allows updates when no transition token is provided", () => {
    expect(
      shouldRunManagerUpdate({
        currentChunk: "24,24",
        targetChunk: "24,24",
        expectedTransitionToken: 5,
      }),
    ).toBe(true);
  });

  it("blocks updates for stale transition token", () => {
    expect(
      shouldRunManagerUpdate({
        transitionToken: 4,
        expectedTransitionToken: 5,
        currentChunk: "24,24",
        targetChunk: "24,24",
      }),
    ).toBe(false);
  });

  it("blocks updates when chunk changed even with current token", () => {
    expect(
      shouldRunManagerUpdate({
        transitionToken: 5,
        expectedTransitionToken: 5,
        currentChunk: "48,48",
        targetChunk: "24,24",
      }),
    ).toBe(false);
  });

  it("allows updates when token and chunk both match", () => {
    expect(
      shouldRunManagerUpdate({
        transitionToken: 5,
        expectedTransitionToken: 5,
        currentChunk: "24,24",
        targetChunk: "24,24",
      }),
    ).toBe(true);
  });
});

describe("resolveEntityActionPathLookup", () => {
  it("returns the clicked action path when transition ownership matches", () => {
    const matchingPath = [{ id: "target-a" }];
    const result = resolveEntityActionPathLookup({
      selectedEntityId: 77,
      clickedHexKey: "10,12",
      actionPaths: new Map<string, Array<{ id: string }>>([["10,12", matchingPath]]),
      actionPathsTransitionToken: 14,
      latestTransitionToken: 14,
    });

    expect(result).toEqual({
      shouldClearStaleSelection: false,
      actionPath: matchingPath,
    });
  });

  it("suppresses stale action-path usage when transition token changed", () => {
    const result = resolveEntityActionPathLookup({
      selectedEntityId: 77,
      clickedHexKey: "10,12",
      actionPaths: new Map<string, Array<{ id: string }>>([["10,12", [{ id: "stale" }]]]),
      actionPathsTransitionToken: 14,
      latestTransitionToken: 15,
    });

    expect(result).toEqual({
      shouldClearStaleSelection: true,
      actionPath: null,
    });
  });

  it("rejects stale lookup during rapid switch churn and accepts refreshed ownership", () => {
    const staleResult = resolveEntityActionPathLookup({
      selectedEntityId: 99,
      clickedHexKey: "22,8",
      actionPaths: new Map<string, Array<{ id: string }>>([["22,8", [{ id: "stale-target" }]]]),
      actionPathsTransitionToken: 30,
      latestTransitionToken: 31,
    });

    expect(staleResult).toEqual({
      shouldClearStaleSelection: true,
      actionPath: null,
    });

    const freshPath = [{ id: "fresh-target" }];
    const freshResult = resolveEntityActionPathLookup({
      selectedEntityId: 99,
      clickedHexKey: "22,8",
      actionPaths: new Map<string, Array<{ id: string }>>([["22,8", freshPath]]),
      actionPathsTransitionToken: 31,
      latestTransitionToken: 31,
    });

    expect(freshResult).toEqual({
      shouldClearStaleSelection: false,
      actionPath: freshPath,
    });
  });
});

describe("shouldAcceptExactTransitionToken", () => {
  it("accepts updates without a transition token", () => {
    expect(shouldAcceptExactTransitionToken(undefined, 3)).toBe(true);
  });

  it("accepts token equal to latest token", () => {
    expect(shouldAcceptExactTransitionToken(3, 3)).toBe(true);
  });

  it("rejects token greater than latest token", () => {
    expect(shouldAcceptExactTransitionToken(4, 3)).toBe(false);
  });

  it("rejects stale token lower than latest token", () => {
    expect(shouldAcceptExactTransitionToken(2, 3)).toBe(false);
  });
});

describe("shouldApplyRefreshToken", () => {
  it("accepts refresh when scheduled token matches latest token", () => {
    expect(shouldApplyRefreshToken(7, 7)).toBe(true);
  });

  it("rejects refresh when scheduled token is stale", () => {
    expect(shouldApplyRefreshToken(6, 7)).toBe(false);
  });
});

describe("shouldRescheduleRefreshToken", () => {
  it("reschedules when scheduled token is older than latest token", () => {
    expect(shouldRescheduleRefreshToken(6, 7)).toBe(true);
  });

  it("does not reschedule when scheduled token equals latest token", () => {
    expect(shouldRescheduleRefreshToken(7, 7)).toBe(false);
  });

  it("does not reschedule when scheduled token is newer than latest token", () => {
    expect(shouldRescheduleRefreshToken(8, 7)).toBe(false);
  });
});

describe("resolveRefreshExecutionToken", () => {
  it("uses latest token when scheduled token is stale", () => {
    expect(resolveRefreshExecutionToken(6, 9)).toBe(9);
  });

  it("keeps scheduled token when it is current", () => {
    expect(resolveRefreshExecutionToken(9, 9)).toBe(9);
  });
});

describe("resolveRefreshExecutionPlan", () => {
  it("applies scheduled work when token is current", () => {
    expect(resolveRefreshExecutionPlan(9, 9)).toEqual({
      shouldApplyScheduled: true,
      shouldRecordSuperseded: false,
      executionToken: 9,
    });
  });

  it("executes latest token and marks superseded when scheduled token is stale", () => {
    expect(resolveRefreshExecutionPlan(7, 9)).toEqual({
      shouldApplyScheduled: false,
      shouldRecordSuperseded: true,
      executionToken: 9,
    });
  });

  it("preserves newer scheduled token while still marking superseded", () => {
    expect(resolveRefreshExecutionPlan(10, 9)).toEqual({
      shouldApplyScheduled: false,
      shouldRecordSuperseded: true,
      executionToken: 10,
    });
  });
});

describe("resolveRefreshRunningActions", () => {
  it("requests reschedule when currently scheduled token is stale", () => {
    expect(resolveRefreshRunningActions(7, 9)).toEqual({
      shouldMarkRerunRequested: true,
      shouldRescheduleTimer: true,
    });
  });

  it("skips timer reschedule when scheduled token is current", () => {
    expect(resolveRefreshRunningActions(9, 9)).toEqual({
      shouldMarkRerunRequested: true,
      shouldRescheduleTimer: false,
    });
  });

  it("skips timer reschedule when scheduled token is newer than latest", () => {
    expect(resolveRefreshRunningActions(10, 9)).toEqual({
      shouldMarkRerunRequested: true,
      shouldRescheduleTimer: false,
    });
  });
});

describe("resolveRefreshCompletionActions", () => {
  it("schedules rerun when a newer request exists", () => {
    expect(
      resolveRefreshCompletionActions({
        appliedToken: 7,
        latestToken: 9,
        rerunRequested: false,
      }),
    ).toEqual({
      hasNewerRequest: true,
      shouldScheduleRerun: true,
      shouldClearRerunRequested: true,
    });
  });

  it("schedules rerun when explicit rerun was requested", () => {
    expect(
      resolveRefreshCompletionActions({
        appliedToken: 9,
        latestToken: 9,
        rerunRequested: true,
      }),
    ).toEqual({
      hasNewerRequest: false,
      shouldScheduleRerun: true,
      shouldClearRerunRequested: true,
    });
  });

  it("does not schedule rerun when no newer request or rerun flag exists", () => {
    expect(
      resolveRefreshCompletionActions({
        appliedToken: 9,
        latestToken: 9,
        rerunRequested: false,
      }),
    ).toEqual({
      hasNewerRequest: false,
      shouldScheduleRerun: false,
      shouldClearRerunRequested: false,
    });
  });
});

describe("shouldRequestTileRefreshForStructureBoundsChange", () => {
  const renderSize = { width: 48, height: 48 };
  const chunkSize = 24;

  it("returns false when current chunk is null", () => {
    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "null",
        isChunkTransitioning: false,
        oldHex: { col: 0, row: 0 },
        newHex: { col: 1, row: 1 },
        renderSize,
        chunkSize,
      }),
    ).toBe(false);
  });

  it("returns false while chunk transition is active", () => {
    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "0,0",
        isChunkTransitioning: true,
        oldHex: { col: 0, row: 0 },
        newHex: { col: 1, row: 1 },
        renderSize,
        chunkSize,
      }),
    ).toBe(false);
  });

  it("returns false for malformed current chunk key", () => {
    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "bad-key",
        isChunkTransitioning: false,
        oldHex: { col: 0, row: 0 },
        newHex: { col: 1, row: 1 },
        renderSize,
        chunkSize,
      }),
    ).toBe(false);
  });

  it("returns true when old or new hex falls inside render bounds", () => {
    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "0,0",
        isChunkTransitioning: false,
        oldHex: { col: 0, row: 0 },
        newHex: { col: 100, row: 100 },
        renderSize,
        chunkSize,
      }),
    ).toBe(true);

    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "0,0",
        isChunkTransitioning: false,
        oldHex: { col: 100, row: 100 },
        newHex: { col: 0, row: 0 },
        renderSize,
        chunkSize,
      }),
    ).toBe(true);
  });

  it("returns false when both old and new hex are outside render bounds", () => {
    expect(
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: "0,0",
        isChunkTransitioning: false,
        oldHex: { col: 100, row: 100 },
        newHex: { col: 200, row: 200 },
        renderSize,
        chunkSize,
      }),
    ).toBe(false);
  });

  it("keeps structure bounds decisions in parity with canonical getRenderBounds edges", () => {
    const cases = [
      { currentChunk: "0,0", renderSize: { width: 48, height: 48 }, chunkSize: 24 },
      { currentChunk: "24,-24", renderSize: { width: 49, height: 49 }, chunkSize: 24 },
      { currentChunk: "72,48", renderSize: { width: 80, height: 65 }, chunkSize: 24 },
    ];

    cases.forEach(({ currentChunk, renderSize, chunkSize }) => {
      const [startRow, startCol] = currentChunk.split(",").map(Number);
      const bounds = getRenderBounds(startRow, startCol, renderSize, chunkSize);

      expect(
        shouldRequestTileRefreshForStructureBoundsChange({
          currentChunk,
          isChunkTransitioning: false,
          oldHex: { col: bounds.minCol, row: bounds.minRow },
          newHex: undefined,
          renderSize,
          chunkSize,
        }),
      ).toBe(true);

      expect(
        shouldRequestTileRefreshForStructureBoundsChange({
          currentChunk,
          isChunkTransitioning: false,
          oldHex: undefined,
          newHex: { col: bounds.maxCol, row: bounds.maxRow },
          renderSize,
          chunkSize,
        }),
      ).toBe(true);

      expect(
        shouldRequestTileRefreshForStructureBoundsChange({
          currentChunk,
          isChunkTransitioning: false,
          oldHex: { col: bounds.minCol - 1, row: bounds.minRow },
          newHex: { col: bounds.maxCol + 1, row: bounds.maxRow + 1 },
          renderSize,
          chunkSize,
        }),
      ).toBe(false);
    });
  });
});

describe("shouldForceShortcutNavigationRefresh", () => {
  it("forces refresh for instant shortcut camera jump", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: true,
        transitionDurationSeconds: 0,
        chunkChanged: true,
      }),
    ).toBe(true);
  });

  it("does not force refresh for animated shortcut camera moves", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: true,
        transitionDurationSeconds: 0.25,
        chunkChanged: true,
      }),
    ).toBe(false);
  });

  it("does not force refresh when shortcut target stays in the same chunk", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: true,
        transitionDurationSeconds: 0,
        chunkChanged: false,
      }),
    ).toBe(false);
  });

  it("does not force refresh for non-shortcut navigation", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: false,
        transitionDurationSeconds: 0,
        chunkChanged: true,
      }),
    ).toBe(false);
  });
});

describe("shouldRunShortcutForceFallback", () => {
  it("runs fallback when chunk changed and initial shortcut switch did not switch", () => {
    expect(
      shouldRunShortcutForceFallback({
        isShortcutNavigation: true,
        chunkChanged: true,
        initialSwitchSucceeded: false,
      }),
    ).toBe(true);
  });

  it("does not run fallback when initial shortcut switch already succeeded", () => {
    expect(
      shouldRunShortcutForceFallback({
        isShortcutNavigation: true,
        chunkChanged: true,
        initialSwitchSucceeded: true,
      }),
    ).toBe(false);
  });

  it("does not run fallback when chunk did not change", () => {
    expect(
      shouldRunShortcutForceFallback({
        isShortcutNavigation: true,
        chunkChanged: false,
        initialSwitchSucceeded: false,
      }),
    ).toBe(false);
  });

  it("does not run fallback for non-shortcut navigation", () => {
    expect(
      shouldRunShortcutForceFallback({
        isShortcutNavigation: false,
        chunkChanged: true,
        initialSwitchSucceeded: false,
      }),
    ).toBe(false);
  });
});

describe("shouldForceRefreshForDuplicateTileUpdate", () => {
  it("forces refresh when duplicate tile update carries a biome delta even if currently offscreen", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      }),
    ).toBe(true);
  });

  it("forces refresh when a duplicate tile update targets a visible hex in the active chunk", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(true);
  });

  it("does not force refresh when tile update is not a duplicate", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: false,
        tileAlreadyKnown: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });

  it("does not force refresh for removeExplored updates", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: true,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });

  it("does not force refresh while chunk transition is in progress", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: true,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });

  it("does not force refresh when chunk is null", () => {
    expect(
      shouldForceRefreshForDuplicateTileUpdate({
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "null",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });
});

describe("resolveDuplicateTileUpdateActions", () => {
  it("forces refresh for duplicate tile updates with biome delta even when offscreen", () => {
    expect(
      resolveDuplicateTileUpdateActions({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      }),
    ).toEqual({
      shouldInvalidateCaches: true,
      shouldRequestRefresh: true,
    });
  });

  it("keeps offscreen duplicate updates in cache-reconcile mode without forcing immediate refresh", () => {
    expect(
      resolveDuplicateTileUpdateActions({
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      }),
    ).toEqual({
      shouldInvalidateCaches: true,
      shouldRequestRefresh: false,
    });
  });

  it("forces refresh when duplicate update is visible in active chunk", () => {
    expect(
      resolveDuplicateTileUpdateActions({
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toEqual({
      shouldInvalidateCaches: true,
      shouldRequestRefresh: true,
    });
  });

  it("does nothing when update is not a duplicate tile add", () => {
    expect(
      resolveDuplicateTileUpdateActions({
        removeExplored: false,
        tileAlreadyKnown: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toEqual({
      shouldInvalidateCaches: false,
      shouldRequestRefresh: false,
    });
  });
});

describe("resolveDuplicateTileUpdateMode", () => {
  it.each([
    {
      name: "duplicate tile has biome delta while offscreen",
      input: {
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      },
      expected: "invalidate_and_refresh",
    },
    {
      name: "duplicate tile is visible and stable",
      input: {
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      },
      expected: "invalidate_and_refresh",
    },
    {
      name: "duplicate tile is offscreen",
      input: {
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      },
      expected: "invalidate_only",
    },
    {
      name: "duplicate tile arrives during chunk transition",
      input: {
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: true,
        isVisibleInCurrentChunk: true,
      },
      expected: "invalidate_only",
    },
    {
      name: "duplicate tile arrives with null chunk",
      input: {
        removeExplored: false,
        tileAlreadyKnown: true,
        currentChunk: "null",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      },
      expected: "invalidate_only",
    },
    {
      name: "update is not a duplicate add",
      input: {
        removeExplored: false,
        tileAlreadyKnown: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      },
      expected: "none",
    },
    {
      name: "update removes explored tile",
      input: {
        removeExplored: true,
        tileAlreadyKnown: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      },
      expected: "none",
    },
  ])("resolves matrix mode when $name", ({ input, expected }) => {
    expect(resolveDuplicateTileUpdateMode(input)).toBe(expected);
  });
});

describe("shouldRunImmediateDuplicateTileRefresh", () => {
  it("runs immediate reconcile when duplicate tile has biome delta in active stable chunk", () => {
    expect(
      shouldRunImmediateDuplicateTileRefresh({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      }),
    ).toBe(true);
  });

  it("does not run immediate reconcile when tile update has no biome delta", () => {
    expect(
      shouldRunImmediateDuplicateTileRefresh({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });

  it("does not run immediate reconcile when chunk is transitioning", () => {
    expect(
      shouldRunImmediateDuplicateTileRefresh({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: true,
        isVisibleInCurrentChunk: true,
      }),
    ).toBe(false);
  });
});

describe("resolveDuplicateTileReconcilePlan", () => {
  it("returns immediate strategy for duplicate biome-delta reconciliation", () => {
    expect(
      resolveDuplicateTileReconcilePlan({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: true,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: false,
      }),
    ).toEqual({
      shouldInvalidateCaches: true,
      refreshStrategy: "immediate",
    });
  });

  it("returns deferred strategy for visible duplicate reconciliation without biome delta", () => {
    expect(
      resolveDuplicateTileReconcilePlan({
        removeExplored: false,
        tileAlreadyKnown: true,
        hasBiomeDelta: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toEqual({
      shouldInvalidateCaches: true,
      refreshStrategy: "deferred",
    });
  });

  it("returns none strategy when duplicate reconciliation is not required", () => {
    expect(
      resolveDuplicateTileReconcilePlan({
        removeExplored: false,
        tileAlreadyKnown: false,
        currentChunk: "24,24",
        isChunkTransitioning: false,
        isVisibleInCurrentChunk: true,
      }),
    ).toEqual({
      shouldInvalidateCaches: false,
      refreshStrategy: "none",
    });
  });
});

describe("waitForChunkTransitionToSettle", () => {
  it("waits through transition promise replacement races", async () => {
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    let reads = 0;

    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });

    const getTransitionPromise = () => {
      reads += 1;
      if (reads <= 2) return first;
      if (reads === 3) return second;
      return null;
    };

    const waitPromise = waitForChunkTransitionToSettle(getTransitionPromise);
    resolveFirst?.();

    let settled = false;
    void waitPromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveSecond?.();
    await waitPromise;
    expect(settled).toBe(true);
  });

  it("invokes error handler and continues waiting for newer transitions", async () => {
    let rejectFirst: ((error?: unknown) => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const capturedErrors: unknown[] = [];
    let reads = 0;

    const first = new Promise<void>((_, reject) => {
      rejectFirst = reject;
    });
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });

    const getTransitionPromise = () => {
      reads += 1;
      if (reads <= 2) return first;
      if (reads === 3) return second;
      return null;
    };

    const waitPromise = waitForChunkTransitionToSettle(getTransitionPromise, (error) => {
      capturedErrors.push(error);
    });

    const failure = new Error("first switch failed");
    rejectFirst?.(failure);
    await Promise.resolve();
    expect(capturedErrors).toEqual([failure]);

    resolveSecond?.();
    await waitPromise;
  });
});

describe("shouldScheduleHydratedChunkRefreshForFetch", () => {
  it("schedules hydrated refresh when fetch area matches current area even during transitions", () => {
    expect(
      shouldScheduleHydratedChunkRefreshForFetch({
        fetchAreaKey: "24,0",
        currentAreaKey: "24,0",
      }),
    ).toBe(true);
  });

  it("does not schedule hydrated refresh when fetch area differs from current area", () => {
    expect(
      shouldScheduleHydratedChunkRefreshForFetch({
        fetchAreaKey: "24,0",
        currentAreaKey: "48,0",
      }),
    ).toBe(false);
  });

  it("does not schedule hydrated refresh when current area is unavailable", () => {
    expect(
      shouldScheduleHydratedChunkRefreshForFetch({
        fetchAreaKey: "24,0",
        currentAreaKey: null,
      }),
    ).toBe(false);
  });
});

describe("resolveHydratedChunkRefreshFlushPlan", () => {
  it("defers and preserves queued chunk keys while transition is in progress", () => {
    expect(
      resolveHydratedChunkRefreshFlushPlan({
        queuedChunkKeys: ["24,0", "48,0"],
        currentChunk: "24,0",
        isChunkTransitioning: true,
      }),
    ).toEqual({
      shouldDefer: true,
      shouldForceRefreshCurrentChunk: false,
      remainingQueuedChunkKeys: ["24,0", "48,0"],
    });
  });

  it("forces refresh when current chunk is queued and scene is stable", () => {
    expect(
      resolveHydratedChunkRefreshFlushPlan({
        queuedChunkKeys: ["24,0", "48,0"],
        currentChunk: "24,0",
        isChunkTransitioning: false,
      }),
    ).toEqual({
      shouldDefer: false,
      shouldForceRefreshCurrentChunk: true,
      remainingQueuedChunkKeys: ["48,0"],
    });
  });

  it("skips refresh when current chunk is not queued and scene is stable", () => {
    expect(
      resolveHydratedChunkRefreshFlushPlan({
        queuedChunkKeys: ["48,0"],
        currentChunk: "24,0",
        isChunkTransitioning: false,
      }),
    ).toEqual({
      shouldDefer: false,
      shouldForceRefreshCurrentChunk: false,
      remainingQueuedChunkKeys: ["48,0"],
    });
  });
});

describe("shouldForceChunkRefreshForZoomDistanceChange", () => {
  it("forces refresh when zoom distance delta reaches the threshold", () => {
    expect(
      shouldForceChunkRefreshForZoomDistanceChange({
        previousDistance: 20,
        nextDistance: 20.75,
        threshold: 0.75,
      }),
    ).toBe(true);
  });

  it("does not force refresh for small zoom drift below threshold", () => {
    expect(
      shouldForceChunkRefreshForZoomDistanceChange({
        previousDistance: 20,
        nextDistance: 20.4,
        threshold: 0.75,
      }),
    ).toBe(false);
  });

  it("does not force refresh when previous distance is unavailable", () => {
    expect(
      shouldForceChunkRefreshForZoomDistanceChange({
        previousDistance: null,
        nextDistance: 40,
        threshold: 0.75,
      }),
    ).toBe(false);
  });
});

describe("resolveControlsChangeChunkRefreshPlan", () => {
  it("requests a debounced refresh on camera movement even without large zoom delta", () => {
    expect(
      resolveControlsChangeChunkRefreshPlan({
        previousDistance: 20,
        nextDistance: 20.2,
        threshold: 0.75,
      }),
    ).toEqual({
      shouldRequestRefresh: true,
      shouldForceRefresh: false,
    });
  });

  it("requests a forced refresh when zoom delta crosses threshold", () => {
    expect(
      resolveControlsChangeChunkRefreshPlan({
        previousDistance: 20,
        nextDistance: 21,
        threshold: 0.75,
      }),
    ).toEqual({
      shouldRequestRefresh: true,
      shouldForceRefresh: true,
    });
  });

  it("skips refresh when distance sample is invalid", () => {
    expect(
      resolveControlsChangeChunkRefreshPlan({
        previousDistance: 20,
        nextDistance: Number.NaN,
        threshold: 0.75,
      }),
    ).toEqual({
      shouldRequestRefresh: false,
      shouldForceRefresh: false,
    });
  });
});
