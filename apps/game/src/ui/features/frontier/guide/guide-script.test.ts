import { describe, expect, it, vi } from "vitest";
import {
  canShowPlace,
  GUIDE_OFF,
  type GuideFacts,
  type GuideRules,
  GUIDE_STEPS,
  isGuideOn,
  nextGuideStep,
  seenGuideLines,
} from "./guide-script";

/** The rules a preset serves, as the dev shard's read on 13 October; the lines must say these numbers and no others. */
const RULES: GuideRules = {
  hutAdds: 6,
  stamina: { explore: 30, move: 10, attack: 30, anHour: 30 },
  xp: { reveal: 2, firstTier: 100 },
  homecomingPercent: 3,
};

const facts = (overrides: Partial<GuideFacts> = {}): GuideFacts => ({
  realm: true,
  barracks: false,
  troopsAtHome: 1_500,
  armies: 0,
  armyActed: false,
  armyTierAffordable: false,
  camp: null,
  siteCleared: false,
  stragglers: false,
  castleAffordable: false,
  onMap: true,
  typeTierAffordable: null,
  armiesTired: false,
  ruin: false,
  chestPaid: false,
  armyBeyondSpire: false,
  losingFight: false,
  storeFull: null,
  seasonOver: false,
  populationFull: false,
  armySelected: false,
  guardInReach: false,
  xpEarned: false,
  researchOpen: false,
  lastHour: false,
  rules: RULES,
  ...overrides,
});

const seen = (...ids: string[]) => new Set(ids);
const foot = (state: GuideFacts, lines: ReadonlySet<string>) => nextGuideStep(state, lines, "foot");

describe("the Aspect of Skill's script", () => {
  it("names itself first, then asks for barracks", () => {
    const arrival = foot(facts(), seen())!;
    expect(arrival.id).toBe("arrival");
    expect(arrival.line(facts())).toBe(
      "I am the Aspect of Skill, Lord. Your realm stays. Each day, the mist takes the rest.",
    );
    expect(foot(facts(), seen("arrival"))?.id).toBe("build-barracks");
  });

  it("skips a line the player has already answered by playing", () => {
    expect(foot(facts({ barracks: true }), seen("arrival"))).toMatchObject({ id: "deploy", target: "open-slot" });
  });

  it("follows the session: reveal, a camp, home, rest, each with its mark", () => {
    const early = seen("arrival", "build-barracks", "deploy");
    expect(foot(facts({ barracks: true, armies: 3, armyActed: true }), early)).toMatchObject({
      id: "first-reveal",
      mark: "pleased",
    });
    expect(foot(facts({ armies: 3, camp: { x: 12, y: 9 } }), seen(...early, "first-reveal"))?.id).toBe("a-camp");
    expect(foot(facts({ armies: 3, armiesTired: true }), seen(...early, "first-reveal", "a-camp"))).toMatchObject({
      id: "rest",
      mark: "rest",
    });
  });

  it("stays silent while no fact holds, and fills a line's slot from the fact", () => {
    const played = seen("arrival", "build-barracks", "deploy", "first-reveal");
    const ready = { barracks: true, armies: 2 };
    expect(foot(facts(ready), played)).toBeNull();
    expect(foot(facts({ ...ready, armyTierAffordable: true }), played)?.id).toBe("first-army-tier");
    const tier = foot(facts({ ...ready, typeTierAffordable: "farm" }), played)!;
    expect(tier.line(facts({ typeTierAffordable: "farm" }))).toBe(
      "Store more, or make more. Each choice holds for every farm.",
    );
    const full = foot(facts({ ...ready, storeFull: "wheat" }), played)!;
    expect(full).toMatchObject({ id: "store-full", mark: "warning" });
    expect(full.line(facts({ storeFull: "wheat" }))).toBe("Your wheat store is full. What does not fit is gone.");
  });

  it("speaks each first once: a clear, a ruin, the plane beyond the spire", () => {
    const played = seen("arrival", "build-barracks", "deploy", "first-reveal");
    const ready = { barracks: true, armies: 2 };
    expect(foot(facts({ ...ready, siteCleared: true }), played)).toMatchObject({
      id: "first-clear",
      target: "army-xp",
    });
    expect(foot(facts({ ...ready, ruin: true }), played)?.id).toBe("first-fallen-site");
    expect(foot(facts({ ...ready, armyBeyondSpire: true }), played)?.id).toBe("first-ethereal");
    expect(foot(facts({ ...ready, stragglers: true }), played)?.id).toBe("first-stragglers");
    expect(foot(facts({ ...ready, chestPaid: true }), played)?.id).toBe("first-chest");
    expect(foot(facts({ ...ready, ruin: true }), seen(...played, "first-fallen-site"))).toBeNull();
  });

  it("speaks the losing fight only on the site card, and the season's end only on its card", () => {
    const all = facts({ losingFight: true, seasonOver: true });
    expect(foot(all, seen("arrival", "build-barracks", "deploy"))).toBeNull();
    expect(nextGuideStep(all, seen(), "site-card")).toMatchObject({ id: "losing-fight", mark: "warning" });
    expect(nextGuideStep(all, seen(), "season-over")?.line(all)).toBe(
      "The mist has lifted. For a while, the land remembers.",
    );
  });

  it("speaks a first-time line at each moment a new player meets a rule, stating the rule in the game's own numbers", () => {
    const answered = seen("arrival", "build-barracks", "deploy", "first-reveal");
    const said = (state: Partial<GuideFacts>) => {
      const step = foot(facts({ barracks: true, armies: 1, ...state }), answered)!;
      return [step.id, step.line(facts(state))];
    };
    expect(said({ populationFull: true })).toEqual([
      "population-full",
      "No population left. Every building takes some. A Hut adds 6.",
    ]);
    expect(said({ armySelected: true })).toEqual([
      "first-army-selected",
      "Explore costs 30 stamina, a move from 10 a tile, an attack 30. 30 come back each hour.",
    ]);
    expect(said({ xpEarned: true })).toEqual([
      "first-xp",
      "Each new tile gives 2 XP. 100 XP buy an attribute's first tier.",
    ]);
    expect(said({ guardInReach: true })[0]).toBe("first-guard-in-reach");
    expect(said({ researchOpen: true })[0]).toBe("first-research");
    expect(said({ lastHour: true })).toEqual([
      "last-hour",
      "The day ends within the hour. Armies still out end with it. Homecoming sends 3% of their troops home.",
    ]);
    // Another preset's numbers are the ones said: none is typed into a line.
    const harsher = { ...RULES, stamina: { explore: 40, move: 15, attack: 50, anHour: 20 } };
    expect(
      foot(facts({ armies: 1, armySelected: true, rules: harsher }), answered)!.line(facts({ rules: harsher })),
    ).toBe("Explore costs 40 stamina, a move from 15 a tile, an attack 50. 20 come back each hour.");
    // A rule the game has not served yet makes no line speak.
    expect(foot(facts({ armies: 1, xpEarned: true, rules: { ...RULES, xp: undefined } }), answered)).toBeNull();
  });

  it("says the order's two gestures once the stamina line is read, in the words of the player's own pointer", () => {
    const read = seen("arrival", "build-barracks", "deploy", "first-army-selected");
    const state = facts({ barracks: true, armies: 1, armySelected: true });
    expect(foot(state, read)!.line(state)).toBe("Click a tile to see an order first. Right-click sends it at once.");
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(foot(state, read)!.line(state)).toBe("Tap a tile to see an order first. Hold the tile to send it at once.");
    vi.unstubAllGlobals();
    expect(foot(facts({ barracks: true, armies: 1 }), read)).toBeNull();
  });

  it("lists every line seen so far in the script's order, as it reads now, for the Menu's Guide", () => {
    const lines = seenGuideLines(facts(), seen("first-army-selected", "arrival", "store-full", "first-type-tier"));
    expect(lines.map(({ id }) => id)).toEqual(["arrival", "first-army-selected", "first-type-tier", "store-full"]);
    // A line whose fact no longer holds still reads as a sentence.
    expect(lines[2].line).toBe("Store more, or make more. Each choice holds for every building of its type.");
    expect(lines[3].line).toBe("A store is full. What does not fit is gone.");
    expect(seenGuideLines(facts(), seen(GUIDE_OFF))).toEqual([]);
  });

  it("speaks until the player turns it off, and then says nothing while keeping what was seen", () => {
    expect(isGuideOn(seen())).toBe(true);
    expect(isGuideOn(seen(...GUIDE_STEPS.map((step) => step.id)))).toBe(true);
    expect(isGuideOn(seen("arrival", GUIDE_OFF))).toBe(false);
    expect(foot(facts(), seen("arrival", GUIDE_OFF))).toBeNull();
    expect(foot(facts(), seen("arrival"))?.id).toBe("build-barracks");
  });

  it("offers Show me for a named place, and the realm only while the player is away from it", () => {
    const place = (id: string) => GUIDE_STEPS.find((step) => step.id === id)?.place;
    expect(canShowPlace(place("build-barracks"), facts({ onMap: true }))).toBe(true);
    expect(canShowPlace(place("build-barracks"), facts({ onMap: false }))).toBe(false);
    expect(canShowPlace(place("a-camp"), facts())).toBe(true);
    expect(canShowPlace(place("first-reveal"), facts())).toBe(false);
  });
});
