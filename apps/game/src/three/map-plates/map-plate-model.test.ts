import { plateRows } from "./map-plate-rows";
import { StructureType, siteName } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { attackOrder, buildArmyPlate, buildStructurePlate, guardsToTell } from "./map-plate-model";

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
        structureName: siteName(129),
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
      structure({ structureName: siteName(29), structureType: StructureType.Mine, mineKind: 1 }),
      0,
      { amount: 1200.4, unit: "Essence" },
    );
    expect(rift).toMatchObject({ name: "Rift", named: false, reward: "1,200 Essence" });
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

  it("lists guard slots as an attacker meets them, highest slot first", () => {
    const slot0 = { type: "crossbowman", tier: 1, count: 516 } as const;
    const slot2 = { type: "paladin", tier: 3, count: 638 } as const;
    expect(attackOrder([slot0, slot2])).toEqual([slot2, slot0]);
  });
});

it("marks a cleared site with a flag, never calls it undefended, and keeps the name every list reads it by", () => {
  expect(
    buildStructurePlate(
      structure({ structureName: siteName(29), structureType: StructureType.Camp, clearedSite: true, guardArmies: [] }),
    ),
  ).toMatchObject({ icon: "flag", name: "Troll · Cleared", guards: null, place: siteName(29) });
});

it("names a Frontier guard by its beast while retaining its combat stack and site lore", () => {
  const plate = buildStructurePlate(
    structure({
      structureType: StructureType.Ruin,
      structureName: siteName(29),
      owner: { address: 0n, ownerName: "", guildName: "" },
      frontierBeast: { beast: "wyvern", name: "Wyvern", scale: 1.35 },
      guardArmies: [{ slot: 0, category: "Knight", tier: 1, count: 2800 }],
    }),
  );
  expect(plate.beast).toBe("Wyvern");
  expect(plate.icon).toBe("beast-wyvern");
  expect(plate.place).toBe(siteName(29));
  // Opened: its place and kind above, the species as its title (at rest it is its token, the species' portrait).
  expect(plateRows(plate).slice(0, 2)).toEqual([
    [{ kind: "owner", text: `${siteName(29)} Ruin` }],
    [{ kind: "title", text: "Wyvern" }],
  ]);
  expect(plate.guards).toEqual([{ type: "knight", tier: 1, count: 2800, beast: "wyvern" }]);
});
