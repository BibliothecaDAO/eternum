import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { stack, type PlateBox } from "./map-plate-layout";
import { attackOrder, buildArmyPlate, buildStructurePlate, homeCode, restingGuard } from "./map-plate-model";

const structure = (fields: Partial<Parameters<typeof buildStructurePlate>[0]> = {}) => ({
  entityId: 29,
  structureName: "Epakehamamut",
  structureType: StructureType.Realm,
  mineKind: undefined,
  level: 0,
  isMine: false,
  isAlly: false,
  owner: { address: 7n, ownerName: "Tamsin", guildName: "" },
  guardArmies: [],
  ...fields,
});

describe("a map plate's facts", () => {
  it("names a realm by its own name and its rank in words, with its owner and guards in slot order", () => {
    const plate = buildStructurePlate(
      structure({
        level: 2,
        guardArmies: [
          { slot: 2, category: "Paladin", tier: 3, count: 638 },
          { slot: 0, category: "Crossbowman", tier: 1, count: 516 },
          { slot: 1, category: "Knight", tier: 2, count: 0 },
        ],
      }),
    );
    expect(plate).toMatchObject({ name: "Epakehamamut", named: true, owner: "Tamsin", rank: "Kingdom" });
    expect(plate.guards).toEqual([
      { type: "crossbowman", tier: 1, count: 516 },
      { type: "paladin", tier: 3, count: 638 },
    ]);
  });

  it("names a nameless thing by its kind, never its id, nobody's as the Vanguard's, and says what taking it gives", () => {
    const camp = buildStructurePlate(
      structure({
        entityId: 129,
        structureName: "",
        structureType: StructureType.Camp,
        owner: { address: 0n, ownerName: "", guildName: "" },
      }),
      0,
      { amount: 250, unit: "points" },
    );
    expect(camp).toMatchObject({
      name: "Camp",
      named: false,
      owner: "The Vanguard",
      reward: "250 points",
      rank: undefined,
    });
    const rift = buildStructurePlate(
      structure({ structureName: "Essence Rift", structureType: StructureType.Mine, mineKind: 1 }),
      0,
      { amount: 1200.4, unit: "Essence" },
    );
    expect(rift).toMatchObject({ name: "Essence Rift", named: false, reward: "1,200 Essence" });
  });

  it("lists troops on their way to a structure, soonest first, with the time left", () => {
    const arrival = (count: number, arrivesAt: bigint) => ({
      structureEntityId: 29,
      resourceId: 0,
      troopType: "Paladin",
      troopTier: "T2",
      count,
      arrivesAt,
      day: 0,
      slot: 0n,
    });
    const plate = buildStructurePlate(
      structure({ incomingTroopArrivals: [arrival(300, 1_200n), arrival(150, 1_060n)] as never }),
      1_000,
    );
    expect(plate.arrivals).toEqual([
      { troops: { type: "paladin", tier: 2, count: 150 }, secondsLeft: 60 },
      { troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 200 },
    ]);
  });

  it("gives an army its owner, the realm it comes from, its short id, troops and stamina", () => {
    const plate = buildArmyPlate(
      {
        entityId: 21 * 2 ** 32 + 11,
        isMine: true,
        owner: { address: 1n, ownerName: "djizus", guildName: "" },
        category: "Knight",
        tier: "T1",
        troopCount: 1400,
        currentStamina: 60,
        maxStamina: 120,
      },
      "Ununtutu",
    );
    expect(plate).toEqual({
      kind: "army",
      relation: "own",
      owner: "djizus",
      homeName: "Ununtutu",
      code: "21·11",
      troops: { type: "knight", tier: 1, count: 1400 },
      stamina: 0.5,
    });
  });

  it("reads a short id off the entity id: home namespace and serial", () => {
    expect(homeCode(12884901891)).toBe("3·3");
  });

  it("rests a guard on one number and lists slots as an attacker meets them, highest slot first", () => {
    const slot0 = { type: "crossbowman", tier: 1, count: 516 } as const;
    const slot2 = { type: "paladin", tier: 3, count: 638 } as const;
    expect(restingGuard([slot0])).toEqual({ kind: "slot", slot: slot0 });
    expect(restingGuard([slot0, slot2])).toEqual({ kind: "total", total: 1154 });
    expect(restingGuard([])).toEqual({ kind: "open" });
    expect(attackOrder([slot0, slot2])).toEqual([slot2, slot0]);
  });
});

describe("plate stacking", () => {
  const box = (id: string, x: number, priority: number): PlateBox => ({
    id,
    x,
    y: 100,
    width: 100,
    height: 24,
    priority,
  });

  it("lifts an overlapping plate clear of the one kept, and drops it when two lifts are not enough", () => {
    const lifts = stack([box("a", 0, 3), box("b", 10, 2), box("c", 20, 1), box("d", 30, 0)]);
    expect([lifts.get("a"), lifts.get("b"), lifts.get("c"), lifts.has("d")]).toEqual([0, 27, 54, false]);
  });

  it("leaves a plate that stands clear where it is", () => {
    expect(stack([box("a", 0, 1), box("far", 400, 0)]).get("far")).toBe(0);
  });
});
