import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBattleTimerLeft } = vi.hoisted(() => ({
  getBattleTimerLeft: vi.fn((battleCooldownEnd?: number) =>
    battleCooldownEnd !== undefined && battleCooldownEnd > 100 ? battleCooldownEnd - 100 : undefined,
  ),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft,
}));

import {
  filterPendingIncomingTroopArrivals,
  resolveStructureIncomingTroopArrivals,
  resolveTimedStructureLabelState,
  shouldTrackTimedStructureLabel,
} from "./structure-label-state";

describe("structure label state", () => {
  beforeEach(() => {
    getBattleTimerLeft.mockClear();
  });

  it("filters incoming troop arrivals to only future entries", () => {
    const result = filterPendingIncomingTroopArrivals(
      [
        { resourceId: 1, troopTier: 1, count: 10, arrivesAt: 90 },
        { resourceId: 1, troopTier: 2, count: 20, arrivesAt: 130 },
      ] as any,
      100,
    );

    expect(result).toEqual([{ resourceId: 1, troopTier: 2, count: 20, arrivesAt: 130 }]);
  });

  it("normalizes incoming troop arrival updates and reports when they changed", () => {
    const result = resolveStructureIncomingTroopArrivals({
      currentIncomingTroopArrivals: [{ resourceId: 1, troopTier: 1, count: 10, arrivesAt: 120 }] as any,
      nextIncomingTroopArrivals: [
        { resourceId: 1, troopTier: 1, count: 10, arrivesAt: 80 },
        { resourceId: 1, troopTier: 2, count: 20, arrivesAt: 130 },
      ] as any,
      nowSeconds: 100,
    });

    expect(result).toEqual({
      changed: true,
      incomingTroopArrivals: [{ resourceId: 1, troopTier: 2, count: 20, arrivesAt: 130 }],
    });
  });

  it("tracks timed labels when either a battle timer or incoming troops are active", () => {
    expect(
      shouldTrackTimedStructureLabel({
        battleCooldownEnd: 120,
        incomingTroopArrivals: undefined,
        nowSeconds: 100,
      }),
    ).toBe(true);

    expect(
      shouldTrackTimedStructureLabel({
        battleCooldownEnd: undefined,
        incomingTroopArrivals: [{ resourceId: 1, troopTier: 1, count: 10, arrivesAt: 130 }] as any,
        nowSeconds: 100,
      }),
    ).toBe(true);

    expect(
      shouldTrackTimedStructureLabel({
        battleCooldownEnd: 90,
        incomingTroopArrivals: [{ resourceId: 1, troopTier: 1, count: 10, arrivesAt: 90 }] as any,
        nowSeconds: 100,
      }),
    ).toBe(false);
  });

  it("recomputes timed label state and drops expired arrivals", () => {
    const result = resolveTimedStructureLabelState({
      battleCooldownEnd: 90,
      incomingTroopArrivals: [
        { resourceId: 1, troopTier: 1, count: 10, arrivesAt: 80 },
        { resourceId: 1, troopTier: 2, count: 20, arrivesAt: 140 },
      ] as any,
      nowSeconds: 100,
    });

    expect(result).toEqual({
      battleTimerLeft: undefined,
      incomingTroopArrivals: [{ resourceId: 1, troopTier: 2, count: 20, arrivesAt: 140 }],
      isActive: true,
    });
  });
});
