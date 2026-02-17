import { describe, expect, it } from "vitest";
import {
  resolveArmyTabSelectionPosition,
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
        recoveryInFlight: false,
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
        recoveryInFlight: false,
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
        recoveryInFlight: false,
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
        recoveryInFlight: false,
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
        recoveryInFlight: false,
      }),
    ).toBe(false);
  });

  it("does not queue recovery when a recovery attempt is already in flight", () => {
    expect(
      shouldQueueArmySelectionRecovery({
        deferDuringChunkTransition: true,
        hasPendingMovement: false,
        isChunkTransitioning: false,
        armyPresentInManager: false,
        recoveryInFlight: true,
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
