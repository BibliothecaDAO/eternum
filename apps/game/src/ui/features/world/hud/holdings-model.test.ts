import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { holdingIcon, kindsHeld } from "./holdings-model";

/** A held structure as the lists read it: its category, and for a mine the kind it presents. */
const holding = (category: StructureType, mineKind = 0) =>
  ({
    category,
    displayName: "",
    isFavorite: false,
    realmLevel: 0,
    structure: { base: { category }, metadata: { mine_kind: mineKind } },
  }) as never;
const ESSENCE_RIFT = 1;
const FRAGMENT_MINE = 2;

describe("the kinds a player holds, as every holdings list names them", () => {
  it("names rifts Rifts, with the rift's painting, as the game does everywhere", () => {
    const held = kindsHeld([holding(StructureType.Realm), holding(StructureType.Mine, ESSENCE_RIFT)]);
    expect(held.map(({ plural, icon, count }) => ({ plural, icon, count }))).toEqual([
      { plural: "Realms", icon: "realm", count: 1 },
      { plural: "Rifts", icon: "rift", count: 1 },
    ]);
    expect(holdingIcon(holding(StructureType.Mine, ESSENCE_RIFT))).toBe("rift");
  });

  it("names fragment mines by their kind, and only both kinds at once Mines", () => {
    expect(kindsHeld([holding(StructureType.Mine, FRAGMENT_MINE)])[0].plural).toBe("Fragment Mines");
    const both = kindsHeld([holding(StructureType.Mine, ESSENCE_RIFT), holding(StructureType.Mine, FRAGMENT_MINE)]);
    expect(both).toEqual([{ kind: StructureType.Mine, plural: "Mines", icon: "mine", count: 2 }]);
  });
});
