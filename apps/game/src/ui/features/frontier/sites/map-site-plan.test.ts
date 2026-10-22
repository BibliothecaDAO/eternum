import { describe, expect, it } from "vitest";
import { mapSiteKind, siteGain } from "./map-site-plan";

const RULES = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};

describe("a Shrine or Well", () => {
  it("is read from its tile's occupier alone", () => {
    expect(mapSiteKind(40)).toBe("Shrine");
    expect(mapSiteKind(41)).toBe("Well");
    expect(mapSiteKind(37)).toBeNull();
  });

  it("gives the fixed XP at a Shrine and the rule's stamina at a Well", () => {
    expect(siteGain("Shrine", RULES)).toBe(200);
    expect(siteGain("Shrine", undefined)).toBeUndefined();
    expect(siteGain("Well", RULES)).toBe(60);
    expect(siteGain("Well", undefined)).toBe(60);
  });
});
