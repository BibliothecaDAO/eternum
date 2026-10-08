import { describe, expect, it } from "vitest";
import { canShowPlace, type GuideFacts, GUIDE_STEPS, isGuideOn, nextGuideStep } from "./guide-script";

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

  it("is on while a line is still to come, and off once every line is seen", () => {
    expect(isGuideOn(seen())).toBe(true);
    expect(isGuideOn(seen(...GUIDE_STEPS.map((step) => step.id)))).toBe(false);
  });

  it("offers Show me for a named place, and the realm only while the player is away from it", () => {
    const place = (id: string) => GUIDE_STEPS.find((step) => step.id === id)?.place;
    expect(canShowPlace(place("build-barracks"), facts({ onMap: true }))).toBe(true);
    expect(canShowPlace(place("build-barracks"), facts({ onMap: false }))).toBe(false);
    expect(canShowPlace(place("a-camp"), facts())).toBe(true);
    expect(canShowPlace(place("first-reveal"), facts())).toBe(false);
  });
});
