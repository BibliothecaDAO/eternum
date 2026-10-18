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
    case "stamina":
      return `${segment.current}/${segment.max}`;
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
  troops: { type: "paladin", tier: 3, count: 300 },
  stamina: { current: 84, max: 150 },
};

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "Moonhand",
  name: "Xeswet",
  named: true,
  strength: 516 + 301 * 3 + 638 * 9,
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
  place: "Duskmere",
  reward: "1,200 Essence",
  strength: 900,
  guards: [{ type: "knight", tier: 2, count: 300 }],
  arrivals: [],
  icon: "rift",
};

describe("what a map plate says (two short rows at rest, three at most opened, never an id)", () => {
  it("rests an army on its player over its troops and exact stamina, and opens it with its home", () => {
    expect(read(army, false)).toEqual(["djizus", "T3 300 84/150"]);
    expect(read(army, true)).toEqual(["djizus Sangsang", "T3 300 84/150"]);
    expect(read({ ...army, stamina: undefined }, false)).toEqual(["djizus", "T3 300"]);
  });

  it("rests a realm on its player and name over its guard total and strength", () => {
    expect(read(realm, false)).toEqual(["Moonhand | Xeswet", "1,455 guard | 7,161 strength"]);
  });

  it("opens a realm on its guard slots in attack order, and the troops on their way, each time before its troops", () => {
    expect(read(realm, true)).toEqual(["Moonhand | Xeswet", "T3 638 › T2 301 › T1 516 | 7,161 strength"]);
    const reinforced = { ...realm, arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }] };
    expect(read(reinforced as StructurePlate, true)).toEqual([
      "Moonhand | Xeswet",
      "T3 638 › T2 301 › T1 516 | 7,161 strength",
      "Arriving 13m T2 300",
    ]);
  });

  it("says Undefended in words where nothing guards it", () => {
    expect(read({ ...realm, guards: [], strength: 0 }, false)).toEqual(["Moonhand | Xeswet", "Undefended"]);
  });

  it("rests a rift or a camp on its lore name and kind over its guard and reward, and opens it with its owner", () => {
    expect(read(rift, false)).toEqual(["Duskmere Essence Rift", "T2 300 | 1,200 Essence"]);
    expect(read(rift, true)).toEqual(["The Vanguard", "Duskmere Essence Rift", "T2 300 | 1,200 Essence"]);
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
