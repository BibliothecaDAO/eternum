import { plateRows } from "./map-plate-rows";
import { StructureType, siteName } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { stack, type PlateBox } from "./map-plate-layout";
import { attackOrder, buildArmyPlate, buildStructurePlate, guardsToTell, restingGuard } from "./map-plate-model";

const structure = (fields: Partial<Parameters<typeof buildStructurePlate>[0]> = {}) => ({
  entityId: 29,
  structureName: "Epakehamamut",
  structureType: StructureType.Realm,
  mineKind: undefined,
  isMine: false,
  isAlly: false,
  owner: { address: 7n, ownerName: "Tamsin", guildName: "" },
  guardArmies: [],
  ...fields,
});

describe("a map plate's facts", () => {
  it("names a realm by its own name, with its owner and its guards in slot order", () => {
    const plate = buildStructurePlate(
      structure({
        guardArmies: [
          { slot: 2, category: "Paladin", tier: 3, count: 638 },
          { slot: 0, category: "Crossbowman", tier: 1, count: 516 },
          { slot: 1, category: "Knight", tier: 2, count: 0 },
        ],
      }),
    );
    expect(plate).toMatchObject({
      name: "Epakehamamut",
      named: true,
      place: undefined,
      owner: "Tamsin",
    });
    expect(plate.guards).toEqual([
      { type: "crossbowman", tier: 1, count: 516 },
      { type: "paladin", tier: 3, count: 638 },
    ]);
  });

  it("keeps a structure with no guard to tell (a game with no guard slots) apart from one that stands undefended", () => {
    expect(buildStructurePlate(structure({ guardArmies: undefined })).guards).toBeNull();
    expect(buildStructurePlate(structure({ guardArmies: [] })).guards).toEqual([]);
    const slot = { slot: 0, category: "Knight", tier: 2, count: 300 };
    expect(guardsToTell([], false)).toBeUndefined();
    expect(guardsToTell([], true)).toEqual([]);
    expect(guardsToTell([slot], false)).toEqual([slot]);
  });

  it("names a nameless thing by its lore name and kind, never its id, nobody's as the Vanguard's, with its reward", () => {
    const camp = buildStructurePlate(
      structure({
        entityId: 129,
        structureName: "",
        structureType: StructureType.Camp,
        owner: { address: 0n, ownerName: "", guildName: "" },
      }),
      0,
      { amount: 640, unit: "Labor" },
    );
    expect(camp).toMatchObject({
      name: "Camp",
      named: false,
      place: siteName(129),
      owner: "The Vanguard",
      reward: "640 Labor",
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

  it("gives an army its owner, the realm it comes from, its troops and its exact stamina, and no id", () => {
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
      troops: { type: "knight", tier: 1, count: 1400 },
      stamina: { current: 60, max: 120 },
    });
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
  // A plate stands on its thing's anchor (its bottom); two-row plate at rest: two 24px rows and the frame's 6px.
  const box = (id: string, x: number, priority: number, height = 54, anchor = 300): PlateBox => ({
    id,
    x,
    y: anchor - height,
    width: 100,
    height,
    priority,
  });

  it("lifts an overlapping plate clear of the one kept, and drops it when two lifts are not enough", () => {
    const lifts = stack([box("a", 0, 3), box("b", 10, 2), box("c", 20, 1), box("d", 30, 0)]);
    expect([lifts.get("a"), lifts.get("b"), lifts.get("c"), lifts.has("d")]).toEqual([0, 57, 114, false]);
  });

  it("lets a one-row plate (a Frontier realm) rise as far as a two-row plate, in steps of its own height", () => {
    // An army on the realm's tile, and a one-row plate above it to the side: the realm clears both 99px up, past the
    // 66px its own two steps reach; a two-row realm clears them at 114px.
    const around = [box("army", 0, 3, 60), box("beside", 60, 2, 30, 235)];
    expect(stack([...around, box("realm", 0, 1, 30)]).get("realm")).toBe(99);
    expect(stack([...around, box("realm", 0, 1)]).get("realm")).toBe(114);
  });

  it("leaves a plate that stands clear where it is", () => {
    expect(stack([box("a", 0, 1), box("far", 400, 0)]).get("far")).toBe(0);
  });
});

it("marks a cleared site with a flag and never calls it undefended", () => {
  expect(
    buildStructurePlate(structure({ structureType: StructureType.Camp, clearedSite: true, guardArmies: [] })),
  ).toMatchObject({ icon: "flag", name: "Camp · Cleared", guards: null, place: undefined });
});

it("names a Frontier guard by its beast while retaining its combat stack and site lore", () => {
  const plate = buildStructurePlate(
    structure({
      structureType: StructureType.Ruin,
      structureName: "",
      owner: { address: 0n, ownerName: "", guildName: "" },
      frontierBeast: { beast: "wyvern", name: "Wyvern", scale: 1.35 },
      guardArmies: [{ slot: 0, category: "Knight", tier: 1, count: 2800 }],
    }),
  );
  expect(plate.beast).toBe("Wyvern");
  expect(plate.icon).toBe("beast-wyvern");
  expect(plate.place).toBe(siteName(29));
  expect(plateRows(plate, true).slice(0, 2)).toEqual([
    [{ kind: "owner", text: `${siteName(29)} Ruin` }],
    [{ kind: "title", text: "Wyvern" }],
  ]);
  expect(plateRows(plate, false)[0]).toEqual([{ kind: "title", text: "Wyvern" }]);
  expect(plate.guards).toEqual([{ type: "knight", tier: 1, count: 2800, beast: "wyvern" }]);
});
