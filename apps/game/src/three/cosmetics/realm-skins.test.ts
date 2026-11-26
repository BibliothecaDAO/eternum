import { REALM_SKIN_FAMILIES, showsWonder } from "@bibliothecadao/eternum";
import { RealmLevels } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";
import {
  BASE_REALM_SKIN,
  REALM_RANKS,
  REALM_SKIN_CODES,
  REALM_SKINS,
  realmSkinIcon,
  realmSkinIsDrawn,
  realmSkinStanding,
  wornRealmSkin,
  type RealmSkinFacts,
} from "./realm-skins";

const NOTHING: RealmSkinFacts = {
  sealHeld: false,
  aspect: null,
  hasWonder: false,
  equipped: REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN,
};
const skin = (id: string) => REALM_SKINS.find((each) => each.id === id)!;

describe("the realm skin catalog", () => {
  it("lists every family the page names, each with a skin", () => {
    expect(new Set(REALM_SKINS.map((each) => each.family))).toEqual(new Set(Object.keys(COSMETICS_WORDS.families)));
  });

  it("calls a family drawn by the game exactly when its skins have paintings", () => {
    const owned = REALM_SKINS.filter((each) => REALM_SKIN_CODES[each.family] !== null);
    expect(owned.map(realmSkinIsDrawn)).toEqual(
      owned.map((each) => realmSkinIcon(each, RealmLevels.Kingdom) !== undefined),
    );
  });

  it("gives every painted skin a painting at every rank, and none to a skin not painted yet", () => {
    expect(REALM_RANKS.map((rank) => realmSkinIcon(BASE_REALM_SKIN, rank))).toEqual([
      "realm-0",
      "realm-1",
      "realm-2",
      "realm-3",
    ]);
    expect(realmSkinIcon(skin("devcon-golden"), RealmLevels.Empire)).toBe("devcon-golden-realm-3");
    expect(realmSkinIcon(skin("season-1-havoc"), RealmLevels.City)).toBeUndefined();
  });
});

describe("a realm skin's standing, from the facts alone", () => {
  it("always owns the base skin and never owns an event skin no fact grants", () => {
    expect(realmSkinStanding(BASE_REALM_SKIN, NOTHING)).toBe("owned");
    const everything: RealmSkinFacts = { ...NOTHING, sealHeld: true, aspect: 1, hasWonder: true };
    expect(realmSkinStanding(skin("devcon"), everything)).toBe("event");
    expect(realmSkinStanding(skin("devcon-golden"), everything)).toBe("event");
  });

  it("owns the Season 1 skin of the player's own Aspect only once the Seal is held", () => {
    expect(realmSkinStanding(skin("season-1-luminary"), { ...NOTHING, aspect: 2 })).toBe("pass");
    expect(realmSkinStanding(skin("season-1-luminary"), { ...NOTHING, sealHeld: true, aspect: 2 })).toBe("owned");
    expect(realmSkinStanding(skin("season-1-havoc"), { ...NOTHING, sealHeld: true, aspect: 2 })).toBe("pass");
  });

  it("owns the Wonder skin of the realm's own Aspect only while that realm holds a Wonder", () => {
    expect(realmSkinStanding(skin("wonder-insight"), { ...NOTHING, aspect: 4, hasWonder: true })).toBe("owned");
    expect(realmSkinStanding(skin("wonder-prowess"), { ...NOTHING, aspect: 4, hasWonder: true })).toBe("wonder");
    expect(realmSkinStanding(skin("wonder-insight"), { ...NOTHING, aspect: 4 })).toBe("wonder");
  });
});

describe("the skin a realm wears", () => {
  const wonderRealm: RealmSkinFacts = { ...NOTHING, sealHeld: true, aspect: 3, hasWonder: true };

  it("wears the first family it holds and the game can draw, in the default order, while its owner equips nothing", () => {
    expect(wornRealmSkin(NOTHING)?.id).toBe("base");
    expect(wornRealmSkin({ ...NOTHING, sealHeld: true, aspect: 3 })?.id).toBe("base");
    expect(wornRealmSkin(wonderRealm)?.id).toBe("wonder-havoc");
  });

  it("wears the family its owner equipped while the realm holds it and the game can draw it, else the default order", () => {
    expect(wornRealmSkin({ ...wonderRealm, equipped: REALM_SKIN_FAMILIES.BASE_REALM_SKIN })?.id).toBe("base");
    expect(wornRealmSkin({ ...wonderRealm, equipped: REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN })?.id).toBe(
      "wonder-havoc",
    );
    const lostTheSeal = { ...wonderRealm, sealHeld: false, equipped: REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN };
    expect(wornRealmSkin(lostTheSeal)?.id).toBe("wonder-havoc");
  });
});

describe("the skin the page shows worn, against how the game draws the realm", () => {
  it("shows the Wonder skin worn exactly when the game draws the realm with its Wonder", () => {
    for (const sealHeld of [false, true])
      for (const aspect of [1, 2, 3, 4] as const)
        for (const hasWonder of [false, true])
          for (const equipped of Object.values(REALM_SKIN_FAMILIES)) {
            const worn = wornRealmSkin({ sealHeld, aspect, hasWonder, equipped });
            expect(worn?.family === "wonder", `${sealHeld} ${aspect} ${hasWonder} ${equipped}`).toBe(
              showsWonder(hasWonder, equipped),
            );
          }
  });

  it("does not assign an Aspect variant to a Wonder realm without an Aspect", () => {
    const worn = wornRealmSkin({ ...NOTHING, hasWonder: true });
    expect(worn.id).toBe("wonder");
    expect(worn.aspect).toBeUndefined();
  });
});
