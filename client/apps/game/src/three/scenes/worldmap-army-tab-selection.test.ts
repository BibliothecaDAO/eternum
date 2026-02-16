import { describe, expect, it, vi } from "vitest";
import {
  resolveArmySelectionStartPosition,
  resolveArmyTabSelectionPosition,
  resolvePendingArmyMovementFallbackDelayMs,
  resolvePendingArmyMovementFallbackScheduleDelayMs,
  shouldAcceptArmyTabSelectionAttempt,
  shouldClearPendingArmyMovement,
  shouldQueueArmySelectionRecovery,
} from "./worldmap-army-tab-selection";

describe("resolveArmyTabSelectionPosition", () => {
  it("prefers rendered army position when available", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: { col: 12, row: -7 },
      selectableArmyNormalizedPosition: { col: 4, row: 2 },
    });

    expect(position).toEqual({ col: 12, row: -7 });
  });

  it("uses normalized selectable army position when rendered position is unavailable", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: undefined,
      selectableArmyNormalizedPosition: { col: 6, row: -2 },
    });

    expect(position).toEqual({ col: 6, row: -2 });
  });

  it("keeps normalized selectable army position unchanged", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: undefined,
      selectableArmyNormalizedPosition: { col: -3, row: 9 },
    });

    expect(position).toEqual({ col: -3, row: 9 });
  });
});

describe("resolveArmySelectionStartPosition", () => {
  it("prefers rendered manager position when available", () => {
    const position = resolveArmySelectionStartPosition({
      renderedManagerPosition: { col: 40, row: -10 },
      selectionHintPosition: { col: 39, row: -10 },
      trackedArmyPosition: { col: 38, row: -10 },
    });

    expect(position).toEqual({ col: 40, row: -10 });
  });

  it("uses selection hint position when rendered manager position is unavailable", () => {
    const position = resolveArmySelectionStartPosition({
      renderedManagerPosition: undefined,
      selectionHintPosition: { col: 8, row: 3 },
      trackedArmyPosition: { col: 7, row: 3 },
    });

    expect(position).toEqual({ col: 8, row: 3 });
  });

  it("falls back to tracked army position when no fresher source is available", () => {
    const position = resolveArmySelectionStartPosition({
      renderedManagerPosition: undefined,
      selectionHintPosition: undefined,
      trackedArmyPosition: { col: -2, row: 15 },
    });

    expect(position).toEqual({ col: -2, row: 15 });
  });

  it("returns undefined when all position sources are missing", () => {
    const position = resolveArmySelectionStartPosition({
      renderedManagerPosition: undefined,
      selectionHintPosition: undefined,
      trackedArmyPosition: undefined,
    });

    expect(position).toBeUndefined();
  });
});

describe("shouldAcceptArmyTabSelectionAttempt", () => {
  it("accepts attempt only when selection succeeded and army is not pending", () => {
    expect(
      shouldAcceptArmyTabSelectionAttempt({
        hasPendingMovement: false,
        selectionSucceeded: true,
      }),
    ).toBe(true);
  });

  it("rejects attempt when selection did not succeed", () => {
    expect(
      shouldAcceptArmyTabSelectionAttempt({
        hasPendingMovement: false,
        selectionSucceeded: false,
      }),
    ).toBe(false);
  });

  it("rejects attempt when army has pending movement", () => {
    expect(
      shouldAcceptArmyTabSelectionAttempt({
        hasPendingMovement: true,
        selectionSucceeded: true,
      }),
    ).toBe(false);
  });
});

describe("shouldQueueArmySelectionRecovery", () => {
  it("queues recovery when interaction should defer and army is missing outside transitions", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: true,
        hasPendingMovement: false,
        isChunkTransitioning: false,
        armyPresentInManager: false,
      }),
    ).toBe(true);
  });

  it("does not queue recovery when army has pending movement", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: true,
        hasPendingMovement: true,
        isChunkTransitioning: false,
        armyPresentInManager: false,
      }),
    ).toBe(false);
  });

  it("does not queue recovery while a chunk transition is in progress", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: true,
        hasPendingMovement: false,
        isChunkTransitioning: true,
        armyPresentInManager: false,
      }),
    ).toBe(false);
  });

  it("does not queue recovery when caller explicitly disabled deferred behavior", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: false,
        hasPendingMovement: false,
        isChunkTransitioning: false,
        armyPresentInManager: false,
      }),
    ).toBe(false);
  });

  it("does not queue recovery when army is already present in manager", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: true,
        hasPendingMovement: false,
        isChunkTransitioning: false,
        armyPresentInManager: true,
      }),
    ).toBe(false);
  });
});

describe("shouldClearPendingArmyMovement", () => {
  it("clears pending movement when started time is missing", () => {
    expect(
      shouldClearPendingArmyMovement({
        pendingMovementStartedAtMs: undefined,
        nowMs: 1000,
        staleAfterMs: 8000,
      }),
    ).toBe(true);
  });

  it("does not clear pending movement before stale threshold", () => {
    expect(
      shouldClearPendingArmyMovement({
        pendingMovementStartedAtMs: 1000,
        nowMs: 8500,
        staleAfterMs: 8000,
      }),
    ).toBe(false);
  });

  it("clears pending movement at stale threshold", () => {
    expect(
      shouldClearPendingArmyMovement({
        pendingMovementStartedAtMs: 1000,
        nowMs: 9000,
        staleAfterMs: 8000,
      }),
    ).toBe(true);
  });
});

describe("resolvePendingArmyMovementFallbackDelayMs", () => {
  it("returns 0 when pending started time is missing", () => {
    expect(
      resolvePendingArmyMovementFallbackDelayMs({
        pendingMovementStartedAtMs: undefined,
        nowMs: 1000,
        staleAfterMs: 8000,
      }),
    ).toBe(0);
  });

  it("returns remaining time before stale threshold", () => {
    expect(
      resolvePendingArmyMovementFallbackDelayMs({
        pendingMovementStartedAtMs: 1000,
        nowMs: 8500,
        staleAfterMs: 8000,
      }),
    ).toBe(500);
  });

  it("returns min retry delay when remaining time is below minimum", () => {
    expect(
      resolvePendingArmyMovementFallbackDelayMs({
        pendingMovementStartedAtMs: 1000,
        nowMs: 8999,
        staleAfterMs: 8000,
        minRetryDelayMs: 16,
      }),
    ).toBe(16);
  });

  it("returns 0 when stale threshold is reached", () => {
    expect(
      resolvePendingArmyMovementFallbackDelayMs({
        pendingMovementStartedAtMs: 1000,
        nowMs: 9000,
        staleAfterMs: 8000,
      }),
    ).toBe(0);
  });
});

describe("resolvePendingArmyMovementFallbackScheduleDelayMs", () => {
  it("uses stale delay for initial scheduling", () => {
    expect(
      resolvePendingArmyMovementFallbackScheduleDelayMs({
        staleAfterMs: 8000,
      }),
    ).toBe(8000);
  });

  it("uses retry delay for rescheduling", () => {
    expect(
      resolvePendingArmyMovementFallbackScheduleDelayMs({
        staleAfterMs: 8000,
        retryDelayMs: 500,
      }),
    ).toBe(500);
  });

  it("schedules retry checks using retry delay instead of stale delay", () => {
    vi.useFakeTimers();
    try {
      const callback = vi.fn();
      const delayMs = resolvePendingArmyMovementFallbackScheduleDelayMs({
        staleAfterMs: 8000,
        retryDelayMs: 500,
      });

      setTimeout(callback, delayMs);

      vi.advanceTimersByTime(499);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
