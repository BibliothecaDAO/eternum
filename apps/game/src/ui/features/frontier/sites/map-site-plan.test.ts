import { describe, expect, it } from "vitest";
import { mapSiteKind, type MapSiteUser, readMapSite } from "./map-site-plan";

const SITE = { col: 40, row: 12, alt: false };
const BESIDE = { col: 41, row: 12, alt: false };
const progress = (overrides: Partial<NonNullable<MapSiteUser["progress"]>> = {}) => ({
  game_id: 1,
  explorer_id: 201,
  level: 2,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 1,
  support: 1,
  pending: null,
  ...overrides,
});
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

  it("gives a level at a Shrine and the rule's stamina at a Well, to a living army beside it", () => {
    expect(readMapSite("Shrine", SITE, user())).toMatchObject({ gain: 1, usable: true });
    expect(readMapSite("Well", SITE, user())).toMatchObject({ gain: 60, usable: true });
    expect(readMapSite("Well", SITE, null).usable).toBe(false);
    expect(readMapSite("Well", SITE, user({ armyTile: { col: 43, row: 12, alt: false } })).usable).toBe(false);
    expect(readMapSite("Well", SITE, user({ armyTile: { ...BESIDE, alt: true } })).usable).toBe(false);
    expect(readMapSite("Well", SITE, user({ army: { troops: { count: 0n } } as MapSiteUser["army"] })).usable).toBe(
      false,
    );
  });

  it("refuses a Shrine to an army with an offer waiting, every attribute maxed, or unknown progress", () => {
    const offer = { id: 1, source: "Level" as const, amount: 1, choices: ["Battle" as const] };
    expect(readMapSite("Shrine", SITE, user({ progress: progress({ pending: offer }) })).usable).toBe(false);
    const maxed = progress({ battle: 5, logistics: 5, scouting: 5, support: 5 });
    expect(readMapSite("Shrine", SITE, user({ progress: maxed })).usable).toBe(false);
    expect(readMapSite("Shrine", SITE, user({ progress: undefined })).usable).toBe(false);
    // A Well asks nothing of progress.
    expect(readMapSite("Well", SITE, user({ progress: maxed })).usable).toBe(true);
  });
});
