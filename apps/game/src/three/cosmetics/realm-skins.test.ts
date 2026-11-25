import { RealmLevels } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";
import { REALM_ASSETS } from "../structures/realm-design";
import {
  BASE_REALM_SKIN,
  NO_MODEL_YET,
  REALM_SKIN_DEFAULT_ORDER,
  REALM_SKINS,
  realmSkinIcon,
  realmSkinStanding,
  type RealmSkinFacts,
} from "./realm-skins";

const RANKS = [RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire];
const NOTHING: RealmSkinFacts = { sealHeld: false, aspect: undefined, wonderAspect: undefined };
const skin = (id: string) => REALM_SKINS.find((each) => each.id === id)!;

describe("the realm skin catalog", () => {
  it("lists every family the page names, each with a skin, and orders the default by them all", () => {
    const families = Object.keys(COSMETICS_WORDS.families);
    expect(new Set(REALM_SKINS.map((each) => each.family))).toEqual(new Set(families));
    expect([...REALM_SKIN_DEFAULT_ORDER].sort()).toEqual([...families].sort());
  });

  it("points every rank at a model the game ships, or says plainly that it has none yet", () => {
    const shipped = new Set(REALM_ASSETS.map((asset) => asset.id));
    for (const each of REALM_SKINS)
      for (const rank of RANKS) {
        const model = each.models[rank];
        if (model !== NO_MODEL_YET) expect(shipped.has(model), `${each.id} at rank ${rank}`).toBe(true);
      }
    expect(RANKS.every((rank) => skin("season-1-prowess").models[rank] === NO_MODEL_YET)).toBe(true);
    expect(RANKS.every((rank) => skin("devcon").models[rank] === NO_MODEL_YET)).toBe(true);
  });

  it("gives every painted skin a painting at every rank, and none to a skin not painted yet", () => {
    expect(RANKS.map((rank) => realmSkinIcon(BASE_REALM_SKIN, rank))).toEqual([
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
    const everything: RealmSkinFacts = { sealHeld: true, aspect: 1, wonderAspect: 1 };
    expect(realmSkinStanding(skin("devcon"), everything)).toBe("event");
    expect(realmSkinStanding(skin("devcon-golden"), everything)).toBe("event");
  });

  it("owns the Season 1 skin of the player's own Aspect only once the Seal is held", () => {
    expect(realmSkinStanding(skin("season-1-luminary"), { ...NOTHING, aspect: 2 })).toBe("pass");
    expect(realmSkinStanding(skin("season-1-luminary"), { ...NOTHING, sealHeld: true, aspect: 2 })).toBe("owned");
    expect(realmSkinStanding(skin("season-1-havoc"), { ...NOTHING, sealHeld: true, aspect: 2 })).toBe("pass");
  });

  it("owns a Wonder skin only for the Aspect of a Wonder realm held", () => {
    expect(realmSkinStanding(skin("wonder-insight"), { ...NOTHING, wonderAspect: 4 })).toBe("owned");
    expect(realmSkinStanding(skin("wonder-prowess"), { ...NOTHING, wonderAspect: 4 })).toBe("wonder");
  });
});
