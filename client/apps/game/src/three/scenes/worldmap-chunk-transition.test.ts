import { describe, expect, it } from "vitest";
import {
  shouldForceShortcutNavigationRefresh,
  resolveRefreshExecutionToken,
  resolveChunkSwitchActions,
  shouldApplyRefreshToken,
  shouldAcceptExactTransitionToken,
  shouldRescheduleRefreshToken,
  shouldAcceptTransitionToken,
  shouldRunManagerUpdate,
} from "./worldmap-chunk-transition";

describe("resolveChunkSwitchActions", () => {
  it("rolls back when fetch failed and target chunk is still active", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: false,
        currentChunk: "24,24",
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
        currentChunk: "24,24",
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

  it("ignores stale transitions when current chunk changed", () => {
    expect(
      resolveChunkSwitchActions({
        fetchSucceeded: true,
        currentChunk: "48,48",
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
        currentChunk: "24,24",
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
      }),
    ).toBe(true);
  });

  it("does not force refresh for animated shortcut camera moves", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: true,
        transitionDurationSeconds: 0.25,
      }),
    ).toBe(false);
  });

  it("does not force refresh for non-shortcut navigation", () => {
    expect(
      shouldForceShortcutNavigationRefresh({
        isShortcutNavigation: false,
        transitionDurationSeconds: 0,
      }),
    ).toBe(false);
  });
});
