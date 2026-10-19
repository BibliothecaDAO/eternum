import { describe, expect, it } from "vitest";

import { plateSize } from "./map-plate-layout";
import type { ArmyPlate, PlateTroops, StructurePlate } from "./map-plate-model";
import { plateRows, restingStamina, type PlateSegment } from "./map-plate-rows";

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

const slots: PlateTroops[] = [
  { type: "crossbowman", tier: 1, count: 516 },
  { type: "knight", tier: 2, count: 301 },
  { type: "paladin", tier: 3, count: 638 },
];

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "Moonhand",
  name: "Xeswet",
  named: true,
  guards: slots,
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
  guards: [{ type: "knight", tier: 2, count: 300 }],
  arrivals: [],
  icon: "rift",
};

const camp: StructurePlate = {
  ...rift,
  name: "Camp",
  place: "Orbroar",
  reward: "640 Labor",
  guards: [{ type: "crossbowman", tier: 1, count: 250 }],
  icon: "camp",
};

describe("what a map plate says (two short rows at rest, three at most opened, never an id)", () => {
  it("rests an army on its player over its troops, and opens it with its home, then its exact stamina on its own row", () => {
    expect(read(army, false)).toEqual(["djizus", "T3 300"]);
    expect(read(army, true)).toEqual(["djizus | Sangsang", "T3 300", "84/150"]);
    expect(read({ ...army, stamina: undefined }, true)).toEqual(["djizus | Sangsang", "T3 300"]);
  });

  it("writes a player and their realm the same on the realm's plate and on its army's", () => {
    const home = { ...realm, owner: "clientlane", name: "Stolsli" };
    const out = { ...army, owner: "clientlane", homeName: "Stolsli" };
    expect(read(home, false)[0]).toBe("clientlane | Stolsli");
    expect(read(out, true)[0]).toBe("clientlane | Stolsli");
    // A home not known leaves the player alone, never an empty name behind a divider.
    expect(read({ ...out, homeName: "" }, true)[0]).toBe("clientlane");
  });

  it("rests an army's stamina as a share under its troops, with no number, and drops it once opened shows x/y", () => {
    expect(restingStamina(army, false)).toBe(0.56);
    expect(restingStamina(army, true)).toBeNull();
    expect(restingStamina({ ...army, stamina: undefined }, false)).toBeNull();
    expect(restingStamina(realm, false)).toBeNull();
    // Laid out with its bar: two rows, the frame, and the bar's 6px; opened, its stamina is the third row.
    expect(plateSize(army, false).height).toBe(2 * 24 + 6 + 6);
    expect(plateSize({ ...army, stamina: undefined }, false).height).toBe(2 * 24 + 6);
    expect(plateSize(army, true).height).toBe(3 * 24 + 6);
    expect(plateSize({ ...army, stamina: undefined }, true).height).toBe(2 * 24 + 6);
  });

  it("rests a realm on its player and name over its guard total, and says no strength", () => {
    expect(read(realm, false)).toEqual(["Moonhand | Xeswet", "1,455 guard"]);
    expect(read({ ...realm, guards: [slots[0]] }, false)).toEqual(["Moonhand | Xeswet", "T1 516"]);
  });

  it("opens a realm on its guard slots in attack order, and the troops on their way, each time before its troops", () => {
    expect(read(realm, true)).toEqual(["Moonhand | Xeswet", "T3 638 › T2 301 › T1 516"]);
    const reinforced = { ...realm, arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }] };
    expect(read(reinforced as StructurePlate, true)).toEqual([
      "Moonhand | Xeswet",
      "T3 638 › T2 301 › T1 516",
      "Arriving 13m T2 300",
    ]);
  });

  it("says Undefended in words where nothing guards it", () => {
    expect(read({ ...realm, guards: [] }, false)).toEqual(["Moonhand | Xeswet", "Undefended"]);
  });

  it("gives a realm no guard row in a game with no guard slots (Frontier), and keeps a guarded site's guard", () => {
    const frontierRealm = { ...realm, relation: "own", owner: "djizus", name: "Niziz", guards: null } as const;
    expect(read(frontierRealm, false)).toEqual(["djizus | Niziz"]);
    expect(read(frontierRealm, true)).toEqual(["djizus | Niziz"]);
    expect(plateSize(frontierRealm, false).height).toBe(24 + 6);
    expect(read({ ...rift, guards: null }, false)).toEqual(["Duskmere"]);
    expect(read({ ...rift, guards: null, reward: undefined }, true)).toEqual(["The Vanguard", "Duskmere Essence Rift"]);
    expect(read(rift, false)).toEqual(["Duskmere", "T2 300"]);
  });

  it("rests a rift or a camp on its lore name over its guard; opened, its owner, kind and what it holds", () => {
    expect(read(rift, false)).toEqual(["Duskmere", "T2 300"]);
    expect(read(rift, true)).toEqual(["The Vanguard", "Duskmere Essence Rift", "T2 300 | 1,200 Essence"]);
    expect(read(camp, false)).toEqual(["Orbroar", "T1 250"]);
    expect(read(camp, true)).toEqual(["The Vanguard", "Orbroar Camp", "T1 250 | 640 Labor"]);
  });

  it("keeps every plate within two rows at rest and three opened", () => {
    const busy = {
      ...rift,
      arrivals: [{ troops: { type: "knight", tier: 1, count: 100 }, secondsLeft: 60 }],
    } as StructurePlate;
    for (const plate of [army, realm, rift, camp, busy, { ...realm, arrivals: busy.arrivals }]) {
      expect(plateRows(plate, false).length).toBeLessThanOrEqual(2);
      expect(plateRows(plate, true).length).toBeLessThanOrEqual(3);
    }
  });
});
