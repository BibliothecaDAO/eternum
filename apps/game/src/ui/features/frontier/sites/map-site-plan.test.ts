import { describe, expect, it } from "vitest";
import { mapSiteKind, type MapSiteUser, readMapSite } from "./map-site-plan";

const SITE = { col: 40, row: 12, alt: false };
const BESIDE = { col: 41, row: 12, alt: false };
const progress = (overrides: Partial<NonNullable<MapSiteUser["progress"]>> = {}) => ({
  game_id: 1,
  explorer_id: 201,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 1,
  scouting_kinds: 0,
  homecoming: 1,
  ...overrides,
});
const RULES = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const user = (overrides: Partial<MapSiteUser> = {}): MapSiteUser => ({
  army: { troops: { count: 100n } } as MapSiteUser["army"],
  armyTile: BESIDE,
  progress: progress(),
  ...overrides,
});

describe("a Shrine or Well", () => {
  it("is read from its tile's occupier alone", () => {
    expect(mapSiteKind(40)).toBe("Shrine");
    expect(mapSiteKind(41)).toBe("Well");
    expect(mapSiteKind(37)).toBeNull();
  });

  it("gives the fixed XP at a Shrine and the rule's stamina at a Well, to a living army beside it", () => {
    expect(readMapSite("Shrine", SITE, user(), RULES)).toMatchObject({ gain: 200, usable: true });
    expect(readMapSite("Shrine", SITE, user(), undefined).gain).toBeUndefined();
    expect(readMapSite("Well", SITE, user(), RULES)).toMatchObject({ gain: 60, usable: true });
    expect(readMapSite("Well", SITE, null, RULES).usable).toBe(false);
    expect(readMapSite("Well", SITE, user({ armyTile: { col: 43, row: 12, alt: false } }), RULES).usable).toBe(false);
    expect(readMapSite("Well", SITE, user({ armyTile: { ...BESIDE, alt: true } }), RULES).usable).toBe(false);
    expect(
      readMapSite("Well", SITE, user({ army: { troops: { count: 0n } } as MapSiteUser["army"] }), RULES).usable,
    ).toBe(false);
  });

  it("lets a legendary army use a Shrine, and keeps it disabled only while the army's progress is unknown", () => {
    const maxed = progress({ battle: 5, logistics: 5, scouting: 5, homecoming: 5 });
    expect(readMapSite("Shrine", SITE, user({ progress: maxed }), RULES).usable).toBe(true);
    expect(readMapSite("Shrine", SITE, user({ progress: undefined }), RULES).usable).toBe(false);
    // A Well asks nothing of progress.
    expect(readMapSite("Well", SITE, user({ progress: undefined }), RULES).usable).toBe(true);
  });
});
