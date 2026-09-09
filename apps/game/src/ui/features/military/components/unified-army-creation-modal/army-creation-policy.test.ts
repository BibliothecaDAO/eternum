import { describe, expect, it } from "vitest";
import { resolveArmyCreationBlockedReason, resolveArmyTroopAvailability } from "./army-creation-policy";

const ready = {
  hasStructure: true,
  needsProvision: false,
  isExplorer: true,
  canCreateExplorer: true,
  hasFreeDirection: true,
  hasGuardSlot: true,
  capacityRemaining: 3000,
  available: 5000,
  troopCount: 1000,
  isLoading: false,
};

describe("army troop availability", () => {
  it.each([
    [5000, 3000, 3000],
    [240, 3000, 240],
    [5000, 120, 120],
    [20, 0, 0],
    [0, 3000, 0],
    [2.9, 3000, 2],
  ])("limits stock %s by remaining capacity %s to %s whole troops", (available, capacity, expected) =>
    expect(resolveArmyTroopAvailability(available, capacity)).toBe(expected),
  );
});

describe("army deployment blocked states", () => {
  it("allows affordable deployment at the cap", () => {
    expect(resolveArmyCreationBlockedReason({ ...ready, troopCount: 3000 })).toBeNull();
  });
  it.each([
    [{ hasStructure: false }, "Structure is still loading."],
    [{ needsProvision: true, available: 0 }, "Structure not provisioned."],
    [{ canCreateExplorer: false }, "Field army cap reached."],
    [{ isExplorer: false, hasGuardSlot: false }, "No free guard slot."],
    [{ hasFreeDirection: false }, "No free spawn hex."],
    [{ capacityRemaining: null }, "Army capacity is still loading."],
    [{ capacityRemaining: 0 }, "Troop cap reached."],
    [{ troopCount: 3001 }, "Troop cap reached."],
    [{ available: 0 }, "Not enough of this troop."],
    [{ available: 999 }, "Not enough of this troop."],
    [{ troopCount: 0 }, "Choose a troop count."],
    [{ isLoading: true }, "Deploying army."],
  ])("explains %j inline", (changes, reason) => {
    expect(resolveArmyCreationBlockedReason({ ...ready, ...changes })).toBe(reason);
  });
  it("guards do not require a spawn hex or an explorer slot", () => {
    expect(
      resolveArmyCreationBlockedReason({
        ...ready,
        isExplorer: false,
        canCreateExplorer: false,
        hasFreeDirection: false,
      }),
    ).toBeNull();
  });
});
