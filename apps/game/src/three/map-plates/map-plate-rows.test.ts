import { describe, expect, it } from "vitest";

import { plateSize } from "./map-plate-layout";
import type { ArmyPlate, PlateTroops, StructurePlate } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/** A plate's rows as a player reads them: a troop stack as its tier and count, a divider as "|". */
const read = (plate: ArmyPlate | StructurePlate) => plateRows(plate).map((row) => row.map(say).join(" "));

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
  name: "Rift",
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

describe("what a map plate says opened (three rows at most, never an id; at rest a thing is its token)", () => {
  it("opens an army with its player and home, then its troops, then its exact stamina on its own row", () => {
    expect(read(army)).toEqual(["djizus | Sangsang", "T3 300", "84/150"]);
    expect(read({ ...army, stamina: undefined })).toEqual(["djizus | Sangsang", "T3 300"]);
    expect(plateSize(army).height).toBe(3 * 24 + 6);
    expect(plateSize({ ...army, stamina: undefined }).height).toBe(2 * 24 + 6);
  });

  it("writes a player and their realm the same on the realm's plate and on its army's", () => {
    const home = { ...realm, owner: "clientlane", name: "Stolsli" };
    const out = { ...army, owner: "clientlane", homeName: "Stolsli" };
    expect(read(home)[0]).toBe("clientlane | Stolsli");
    expect(read(out)[0]).toBe("clientlane | Stolsli");
    // A home not known leaves the player alone, never an empty name behind a divider.
    expect(read({ ...out, homeName: "" })[0]).toBe("clientlane");
  });

  it("opens a realm on its guard slots in attack order, and the troops on their way, each time before its troops", () => {
    expect(read(realm)).toEqual(["Moonhand | Xeswet", "T3 638 › T2 301 › T1 516"]);
    const reinforced = { ...realm, arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }] };
    expect(read(reinforced as StructurePlate)).toEqual([
      "Moonhand | Xeswet",
      "T3 638 › T2 301 › T1 516",
      "Arriving 13m T2 300",
    ]);
  });

  it("carries each guard slot's stamina to its stack (owner, 2026-10-19 13:00Z: 'army stamina on structure hover')", () => {
    const rested = { ...slots[0], stamina: { current: 84, max: 120 } };
    const tired = { ...slots[2], stamina: { current: 12, max: 120 } };
    const troops = plateRows({ ...realm, guards: [rested, tired] })
      .flat()
      .flatMap((segment) => (segment.kind === "troops" ? [segment.troops.stamina ?? null] : []));
    // In attack order: the paladins (slot 2) first.
    expect(troops).toEqual([
      { current: 12, max: 120 },
      { current: 84, max: 120 },
    ]);
  });

  it("says Undefended in words where nothing guards it", () => {
    expect(read({ ...realm, guards: [] })).toEqual(["Moonhand | Xeswet", "Undefended"]);
  });

  it("gives a realm no guard row in a game with no guard slots (Frontier), and keeps a guarded site's guard", () => {
    const frontierRealm = { ...realm, relation: "own", owner: "djizus", name: "Niziz", guards: null } as const;
    expect(read(frontierRealm)).toEqual(["djizus | Niziz"]);
    expect(plateSize(frontierRealm).height).toBe(24 + 6);
    expect(read({ ...rift, guards: null, reward: undefined })).toEqual(["The Vanguard", "Duskmere Rift"]);
  });

  it("opens a rift or a camp on its owner, its lore name and kind, then its guard and what it holds", () => {
    expect(read(rift)).toEqual(["The Vanguard", "Duskmere Rift", "T2 300 | 1,200 Essence"]);
    expect(read(camp)).toEqual(["The Vanguard", "Orbroar Camp", "T1 250 | 640 Labor"]);
  });

  it("opens a cleared site on its name and that it is cleared, with no holder above it", () => {
    const cleared = {
      ...camp,
      owner: "",
      name: "Camp · Cleared",
      guards: null,
      reward: undefined,
      icon: "flag",
    } as const;
    expect(read(cleared, "open")).toEqual(["Orbroar Camp · Cleared"]);
  });

  it("keeps every plate within three rows", () => {
    const busy = {
      ...rift,
      arrivals: [{ troops: { type: "knight", tier: 1, count: 100 }, secondsLeft: 60 }],
    } as StructurePlate;
    for (const plate of [army, realm, rift, camp, busy, { ...realm, arrivals: busy.arrivals }])
      expect(plateRows(plate).length).toBeLessThanOrEqual(3);
  });
});
