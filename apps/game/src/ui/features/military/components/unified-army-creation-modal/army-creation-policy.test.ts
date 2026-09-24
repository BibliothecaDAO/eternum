import { describe, expect, it } from "vitest";
import {
  describeTroopTraining,
  resolveArmyCreationBlockedReason,
  resolveArmyTroopAvailability,
  resolveInitialTroop,
  resolveSpawnDirection,
  resolveTroopAvailabilityReason,
} from "./army-creation-policy";
import { TroopTier, TroopType } from "@bibliothecadao/types";

const noBarracks = { name: "Knight T1", perHour: 0, secondsToFullArmy: null };
const training = { name: "Knight T1", perHour: 250, secondsToFullArmy: 7_800 };

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
  supply: noBarracks,
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
    [{ available: 0 }, "No Knight T1 troops. A Knight T1 barracks on the realm board trains them."],
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

describe("troop supply", () => {
  it("names the barracks that trains a troop the realm has none of", () => {
    expect(resolveTroopAvailabilityReason({ capacityRemaining: 3000, available: 0, supply: noBarracks })).toBe(
      "No Knight T1 troops. A Knight T1 barracks on the realm board trains them.",
    );
  });
  it("shows the training rate and when a full army is ready while a barracks trains", () => {
    expect(resolveTroopAvailabilityReason({ capacityRemaining: 3000, available: 0, supply: training })).toBe(
      "Training 250 Knight T1 per hour; a full army in 2h 10m.",
    );
    expect(describeTroopTraining({ ...training, secondsToFullArmy: 0 })).toBe(
      "Training 250 Knight T1 per hour; a full army is ready.",
    );
    expect(describeTroopTraining(noBarracks)).toBeNull();
  });
  it("has no availability reason while a troop can be chosen", () => {
    expect(resolveTroopAvailabilityReason({ capacityRemaining: 3000, available: 1, supply: noBarracks })).toBeNull();
    expect(resolveTroopAvailabilityReason({ capacityRemaining: 0, available: 5000, supply: training })).toBe(
      "Troop cap reached.",
    );
  });
});

describe("initial troop", () => {
  const options = (knights: number, crossbows: number) => [
    {
      type: TroopType.Crossbowman,
      label: "CROSSBOW",
      tiers: [{ tier: TroopTier.T1, available: crossbows, resourceTrait: "" }],
    },
    { type: TroopType.Knight, label: "KNIGHT", tiers: [{ tier: TroopTier.T1, available: knights, resourceTrait: "" }] },
  ];
  const knightsOnly = (troop: { type: TroopType }) => troop.type === TroopType.Knight;

  it("opens on a troop the realm holds", () => {
    expect(resolveInitialTroop(options(0, 40), knightsOnly)).toEqual({
      type: TroopType.Crossbowman,
      tier: TroopTier.T1,
    });
  });
  it("with none on hand, opens on a troop the mode lets the realm train", () => {
    expect(resolveInitialTroop(options(0, 0), knightsOnly)).toEqual({ type: TroopType.Knight, tier: TroopTier.T1 });
    expect(resolveInitialTroop(options(0, 0), () => false)).toBeNull();
  });
});

describe("spawn direction", () => {
  it("moves off a hex an army now stands on to the first free one", () => {
    expect(resolveSpawnDirection(0, [1, 2, 3, 4, 5], undefined)).toBe(1);
  });
  it("keeps a choice that is still free, and keeps a caller's clicked hex", () => {
    expect(resolveSpawnDirection(3, [1, 3], undefined)).toBe(3);
    expect(resolveSpawnDirection(3, [1], 4)).toBe(4);
  });
  it("chooses nothing when no hex is free", () => {
    expect(resolveSpawnDirection(0, [], undefined)).toBeNull();
  });
});
