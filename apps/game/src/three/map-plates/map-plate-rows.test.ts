import { describe, expect, it } from "vitest";

import type { ArmyPlate, StructurePlate } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/** A plate's rows as a player reads them: a troop stack as its tier and count, a divider as "|". */
const read = (plate: ArmyPlate | StructurePlate, open: boolean) =>
  plateRows(plate, open).map((row) => row.map(say).join(" "));

const say = (segment: PlateSegment): string => {
  switch (segment.kind) {
    case "troops":
      return `T${segment.troops.tier} ${segment.troops.count.toLocaleString("en-US")}`;
    case "next":
      return "›";
    case "divider":
      return "|";
    default:
      return segment.text;
  }
};

const army: ArmyPlate = {
  kind: "army",
  relation: "own",
  owner: "djizus",
  homeName: "Sangsang",
  code: "19·12",
  troops: { type: "paladin", tier: 3, count: 300 },
  stamina: 0.5,
};

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "Moonhand",
  rank: "Kingdom",
  name: "Xeswet",
  named: true,
  code: "7·1",
  guards: [
    { type: "crossbowman", tier: 1, count: 516 },
    { type: "knight", tier: 2, count: 301 },
    { type: "paladin", tier: 3, count: 638 },
  ],
  arrivals: [],
  icon: "realm",
};

const rift: StructurePlate = {
  kind: "structure",
  relation: "neutral",
  owner: "The Vanguard",
  name: "Essence Rift",
  named: false,
  reward: "1,200 Essence",
  code: "0·103",
  guards: [{ type: "knight", tier: 2, count: 300 }],
  arrivals: [],
  icon: "rift",
};

describe("what a map plate says (the owner's round 5: two short rows at rest, three at most opened)", () => {
  it("rests an army on its player over its troops, and opens it on the same two rows with its home and id", () => {
    expect(read(army, false)).toEqual(["djizus", "T3 300"]);
    expect(read(army, true)).toEqual(["djizus Sangsang 19·12", "T3 300"]);
  });

  it("rests a realm on its player and rank over its name and guard total, never a level number", () => {
    expect(read(realm, false)).toEqual(["Moonhand Kingdom", "Xeswet | 1,455"]);
  });

  it("opens a realm on its guard slots in attack order, and the troops on their way on a third row", () => {
    expect(read(realm, true)).toEqual(["Moonhand Kingdom", "Xeswet | T3 638 › T2 301 › T1 516"]);
    const reinforced = { ...realm, arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }] };
    expect(read(reinforced as StructurePlate, true)).toEqual([
      "Moonhand Kingdom",
      "Xeswet | T3 638 › T2 301 › T1 516",
      "Arriving T2 300 13m",
    ]);
  });

  it("says Undefended in words where nothing guards it", () => {
    expect(read({ ...realm, guards: [] }, false)).toEqual(["Moonhand Kingdom", "Xeswet | Undefended"]);
  });

  it("rests a rift or a camp on its kind and what taking it gives over its guard, and opens it with its owner and id", () => {
    expect(read(rift, false)).toEqual(["Essence Rift | 1,200 Essence", "T2 300"]);
    expect(read(rift, true)).toEqual(["The Vanguard 0·103", "Essence Rift | 1,200 Essence", "T2 300"]);
  });

  it("keeps every plate within two rows at rest and three opened", () => {
    const busy = {
      ...rift,
      arrivals: [{ troops: { type: "knight", tier: 1, count: 100 }, secondsLeft: 60 }],
    } as StructurePlate;
    for (const plate of [army, realm, rift, busy, { ...realm, arrivals: busy.arrivals }]) {
      expect(plateRows(plate, false).length).toBeLessThanOrEqual(2);
      expect(plateRows(plate, true).length).toBeLessThanOrEqual(3);
    }
  });
});
