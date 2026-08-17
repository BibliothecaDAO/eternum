import { describe, expect, it } from "vitest";
import { shouldQueueArmySelectionRecovery } from "./worldmap-army-tab-selection";

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
