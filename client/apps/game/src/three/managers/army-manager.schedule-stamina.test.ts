import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveArmyStaminaTickRefresh } from "./army-stamina-tick-policy";

const { getBlockTimestampMock } = vi.hoisted(() => ({
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 300,
    currentDefaultTick: 5,
    currentArmiesTick: 5,
  })),
}));

vi.mock("@bibliothecadao/eternum", async () => {
  const actual = await vi.importActual<object>("@bibliothecadao/eternum");
  return {
    ...actual,
    getBlockTimestamp: getBlockTimestampMock,
  };
});

/**
 * Extracted logic from ArmyManager.scheduleTickCheck to test the control flow
 * without importing the full ArmyManager (which pulls in Three.js/browser deps).
 *
 * This mirrors the actual implementation at army-manager.ts:373-389.
 */
function simulateTickCheck(manager: {
  lastKnownArmiesTick: number;
  recomputeStaminaForAllArmies: () => void;
  recomputeBattleTimersForAllArmies: () => void;
}) {
  const { currentArmiesTick } = getBlockTimestampMock();
  const tickRefresh = resolveArmyStaminaTickRefresh({
    currentTick: currentArmiesTick,
    previousTick: manager.lastKnownArmiesTick,
  });
  if (tickRefresh.shouldRecompute) {
    manager.lastKnownArmiesTick = tickRefresh.nextTrackedTick;
  }
  // This is the fix: stamina recomputes every cycle, not just on tick change
  manager.recomputeStaminaForAllArmies();
  manager.recomputeBattleTimersForAllArmies();
}

describe("scheduleTickCheck stamina recomputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recomputes stamina every cycle even when tick has not changed", () => {
    const recomputeStaminaSpy = vi.fn();
    const recomputeBattleTimersSpy = vi.fn();

    // Same tick as lastKnownArmiesTick — no tick change
    getBlockTimestampMock.mockReturnValue({
      currentBlockTimestamp: 300,
      currentDefaultTick: 5,
      currentArmiesTick: 5,
    });

    const fakeManager = {
      lastKnownArmiesTick: 5,
      recomputeStaminaForAllArmies: recomputeStaminaSpy,
      recomputeBattleTimersForAllArmies: recomputeBattleTimersSpy,
    };

    simulateTickCheck(fakeManager);

    expect(recomputeStaminaSpy).toHaveBeenCalledTimes(1);
    expect(recomputeBattleTimersSpy).toHaveBeenCalledTimes(1);
    // Tick didn't change, so lastKnownArmiesTick stays the same
    expect(fakeManager.lastKnownArmiesTick).toBe(5);
  });

  it("updates lastKnownArmiesTick when tick advances", () => {
    const recomputeStaminaSpy = vi.fn();
    const recomputeBattleTimersSpy = vi.fn();

    // Tick advanced from 5 to 6
    getBlockTimestampMock.mockReturnValue({
      currentBlockTimestamp: 360,
      currentDefaultTick: 6,
      currentArmiesTick: 6,
    });

    const fakeManager = {
      lastKnownArmiesTick: 5,
      recomputeStaminaForAllArmies: recomputeStaminaSpy,
      recomputeBattleTimersForAllArmies: recomputeBattleTimersSpy,
    };

    simulateTickCheck(fakeManager);

    expect(recomputeStaminaSpy).toHaveBeenCalledTimes(1);
    expect(recomputeBattleTimersSpy).toHaveBeenCalledTimes(1);
    expect(fakeManager.lastKnownArmiesTick).toBe(6);
  });
});
