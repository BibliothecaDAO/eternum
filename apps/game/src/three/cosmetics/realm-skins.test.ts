import { DRAWN_REALM_SKINS, REALM_SKIN_FAMILIES, showsWonder } from "@bibliothecadao/eternum";
import { RealmLevels } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import {
  GOLDEN_DEVCON_HOLDERS,
  REGULAR_DEVCON_HOLDERS,
} from "../../../../../contracts/l3/world-native/schema/devcon-holders.gen";
import { entryRealmPainting, realmPaintingKind } from "@/ui/design-system/home-icons";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";
import {
  BASE_REALM_SKIN,
  REALM_RANKS,
  REALM_SKIN_DEFAULT_ORDER,
  REALM_SKINS,
  realmSkinIcon,
  realmSkinStanding,
  realmSkinWearableOnRealm,
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

  it("gives every skin in the catalog a painting at every rank and draws every Season 1 Aspect", () => {
    expect(REALM_RANKS.map((rank) => realmSkinIcon(BASE_REALM_SKIN, rank))).toEqual([
      "realm-0",
      "realm-1",
      "realm-2",
      "realm-3",
    ]);
    expect(realmSkinIcon(skin("devcon-golden"), RealmLevels.Empire)).toBe("devcon-golden-realm-3");
    expect(realmSkinIcon(skin("season-1-havoc"), RealmLevels.City)).toBe("season-1-havoc-realm-1");
    expect(realmSkinIcon(skin("wonder-prowess"), RealmLevels.Settlement)).toBe("wonder-prowess-realm-0");
    expect(realmSkinIcon(skin("wonder-luminary"), RealmLevels.City)).toBe("wonder-luminary-realm-1");
    expect(realmSkinIcon(skin("wonder-havoc"), RealmLevels.Kingdom)).toBe("wonder-havoc-realm-2");
    expect(realmSkinIcon(skin("wonder-insight"), RealmLevels.Empire)).toBe("wonder-insight-realm-3");
    for (const each of REALM_SKINS) {
      for (const rank of REALM_RANKS) {
        expect(realmSkinIcon(each, rank), `${each.id} @ ${rank}`).toBeTruthy();
      }
    }
    const drawnCodes = new Set<number>(DRAWN_REALM_SKINS);
    for (const each of REALM_SKINS) {
      if (drawnCodes.has(each.code)) {
        for (const rank of REALM_RANKS) expect(realmSkinIcon(each, rank)).toBeTruthy();
      }
    }
    expect(REALM_SKIN_DEFAULT_ORDER).toEqual([
      COSMETICS_WORDS.families.wonder,
      COSMETICS_WORDS.families["season-1"],
      COSMETICS_WORDS.goldenDevcon,
      COSMETICS_WORDS.devcon,
      COSMETICS_WORDS.families.base,
    ]);
  });
});

describe("a realm skin's standing, from the facts alone", () => {
  it("always owns the base skin and owns Devcon skins only when held or dev-unlocked", () => {
    expect(realmSkinStanding(BASE_REALM_SKIN, NOTHING)).toBe("owned");
    const everythingElse: RealmSkinFacts = { ...NOTHING, sealHeld: true, aspect: 1, hasWonder: true };
    expect(realmSkinStanding(skin("devcon"), everythingElse)).toBe("event");
    expect(realmSkinStanding(skin("devcon-golden"), everythingElse)).toBe("event");

    expect(realmSkinStanding(skin("devcon"), { ...NOTHING, devconHeld: true })).toBe("owned");
    expect(realmSkinStanding(skin("devcon-golden"), { ...NOTHING, devconHeld: true })).toBe("event");
    expect(realmSkinStanding(skin("devcon"), { ...NOTHING, goldenDevconHeld: true })).toBe("owned");
    expect(realmSkinStanding(skin("devcon-golden"), { ...NOTHING, goldenDevconHeld: true })).toBe("owned");

    const devUnlocked: RealmSkinFacts = { ...NOTHING, aspect: 2, devUnlocked: true };
    expect(realmSkinStanding(skin("devcon"), devUnlocked)).toBe("owned");
    expect(realmSkinStanding(skin("devcon-golden"), devUnlocked)).toBe("owned");
    expect(realmSkinStanding(skin("season-1-luminary"), devUnlocked)).toBe("owned");
    expect(realmSkinStanding(skin("wonder-luminary"), devUnlocked)).toBe("owned");
  });

  it("owns all four Season 1 Aspect skins once the Seal is held, regardless of realm Aspect", () => {
    const seasonOne = REALM_SKINS.filter((each) => each.family === "season-1");
    expect(seasonOne).toHaveLength(4);
    for (const each of seasonOne) {
      expect(realmSkinStanding(each, { ...NOTHING, aspect: 2 })).toBe("pass");
      expect(realmSkinStanding(each, { ...NOTHING, sealHeld: true, aspect: 2 })).toBe("owned");
      expect(realmSkinStanding(each, { ...NOTHING, sealHeld: true, aspect: null })).toBe("owned");
    }
  });

  it("marks only the realm's own Aspect and unaligned skins as wearable on the realm", () => {
    const luminaryRealm: RealmSkinFacts = { ...NOTHING, sealHeld: true, aspect: 2 };
    expect(realmSkinWearableOnRealm(BASE_REALM_SKIN, luminaryRealm)).toBe(true);
    expect(realmSkinWearableOnRealm(skin("season-1-luminary"), luminaryRealm)).toBe(true);
    expect(realmSkinWearableOnRealm(skin("season-1-prowess"), luminaryRealm)).toBe(false);
    expect(realmSkinWearableOnRealm(skin("season-1-havoc"), luminaryRealm)).toBe(false);
    expect(realmSkinWearableOnRealm(skin("season-1-insight"), luminaryRealm)).toBe(false);

    const noRealm: RealmSkinFacts = { ...NOTHING, sealHeld: true, aspect: null };
    expect(realmSkinWearableOnRealm(BASE_REALM_SKIN, noRealm)).toBe(true);
    for (const each of REALM_SKINS.filter((item) => item.family === "season-1")) {
      expect(realmSkinWearableOnRealm(each, noRealm)).toBe(false);
    }
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
    expect(wornRealmSkin({ ...NOTHING, sealHeld: true, aspect: 3 })?.id).toBe("season-1-havoc");
    expect(wornRealmSkin(wonderRealm)?.id).toBe("wonder-havoc");
  });

  it("wears the family its owner equipped while the realm holds it and the game can draw it, else the default order", () => {
    expect(wornRealmSkin({ ...wonderRealm, equipped: REALM_SKIN_FAMILIES.BASE_REALM_SKIN })?.id).toBe("base");
    expect(wornRealmSkin({ ...wonderRealm, equipped: REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN })?.id).toBe(
      "season-1-havoc",
    );
    const lostTheSeal = { ...wonderRealm, sealHeld: false, equipped: REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN };
    expect(wornRealmSkin(lostTheSeal)?.id).toBe("wonder-havoc");
    expect(wornRealmSkin({ ...NOTHING, devconHeld: true }).id).toBe("devcon");
    expect(wornRealmSkin({ ...NOTHING, goldenDevconHeld: true }).id).toBe("devcon-golden");
    expect(
      wornRealmSkin({
        ...NOTHING,
        goldenDevconHeld: true,
        equipped: REALM_SKIN_FAMILIES.DEVCON_REALM_SKIN,
      }).id,
    ).toBe("devcon");
    expect(wornRealmSkin({ ...NOTHING, aspect: 3, devUnlocked: true }).id).toBe("base");
    expect(
      wornRealmSkin({
        ...NOTHING,
        aspect: 3,
        devUnlocked: true,
        equipped: REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN,
      }).id,
    ).toBe("devcon-golden");
    expect(
      wornRealmSkin({
        ...NOTHING,
        aspect: 3,
        devUnlocked: true,
        equipped: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN,
      }).id,
    ).toBe("wonder-havoc");
    expect(realmPaintingKind(REALM_SKIN_FAMILIES.DEVCON_REALM_SKIN, 1)).toBe("devcon");
    expect(realmPaintingKind(REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN, 1)).toBe("devcon-golden");
    expect(entryRealmPainting({ address: REGULAR_DEVCON_HOLDERS[0], order: 1 }).painting).toBe("devcon");
    expect(entryRealmPainting({ address: GOLDEN_DEVCON_HOLDERS[0], order: 1 }).painting).toBe("devcon-golden");
    expect(
      entryRealmPainting({ address: "0x99", order: 1, realm_skin: REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN }, false)
        .painting,
    ).toBe("realm");
    expect(
      entryRealmPainting({ address: "0x99", order: 1, realm_skin: REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN }, true)
        .painting,
    ).toBe("devcon-golden");
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
              showsWonder({ hasWonder, sealHeld, aspect }, equipped),
            );
          }
  });

  it("falls back to the base skin for a Wonder realm without an Aspect", () => {
    const worn = wornRealmSkin({ ...NOTHING, hasWonder: true });
    expect(worn.id).toBe("base");
    expect(worn.aspect).toBeUndefined();
  });
});
