import { describe, expect, it } from "vitest";
import {
  shouldForceShortcutNavigationRefresh,
  shouldForceRefreshForDuplicateTileUpdate,
  shouldRunShortcutForceFallback,
  resolveRefreshExecutionToken,
  resolveChunkSwitchActions,
  shouldApplyRefreshToken,
  shouldAcceptExactTransitionToken,
  shouldRescheduleRefreshToken,
  shouldAcceptTransitionToken,
  shouldRunManagerUpdate,
  waitForChunkTransitionToSettle,
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

describe("shouldAcceptTransitionToken", () => {
  it("accepts updates without a transition token", () => {
    expect(shouldAcceptTransitionToken(undefined, 3)).toBe(true);
  });

  it("accepts token equal to latest token", () => {
    expect(shouldAcceptTransitionToken(3, 3)).toBe(true);
  });

  it("accepts token greater than latest token", () => {
    expect(shouldAcceptTransitionToken(4, 3)).toBe(true);
  });

  it("rejects stale token lower than latest token", () => {
    expect(shouldAcceptTransitionToken(2, 3)).toBe(false);
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
