import { describe, expect, it } from "vitest";
import { resolveArmyTabSelectionPosition, shouldQueueArmySelectionRecovery } from "./worldmap-army-tab-selection";

describe("resolveArmyTabSelectionPosition", () => {
  it("prefers the rendered position and otherwise uses the selectable snapshot", () => {
    expect(
      resolveArmyTabSelectionPosition({
        renderedArmyPosition: { col: 12, row: -7 },
        selectableArmyNormalizedPosition: { col: 4, row: 2 },
      }),
    ).toEqual({ col: 12, row: -7 });
    expect(
      resolveArmyTabSelectionPosition({
        selectableArmyNormalizedPosition: { col: 4, row: 2 },
      }),
    ).toEqual({ col: 4, row: 2 });
  });
});

describe("shouldQueueArmySelectionRecovery", () => {
  it("queues only for an unlocked missing army outside a transition", () => {
    const base = {
      deferDuringChunkTransition: true,
      hasPendingMovement: false,
      isChunkTransitioning: false,
      armyPresentInManager: false,
      recoveryInFlight: false,
    };
    expect(shouldQueueArmySelectionRecovery(base)).toBe(true);
    expect(shouldQueueArmySelectionRecovery({ ...base, hasPendingMovement: true })).toBe(false);
    expect(shouldQueueArmySelectionRecovery({ ...base, isChunkTransitioning: true })).toBe(false);
    expect(shouldQueueArmySelectionRecovery({ ...base, recoveryInFlight: true })).toBe(false);
  });
});
