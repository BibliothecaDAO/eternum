import { describe, expect, it } from "vitest";
import { canShowPlace, type GuideFacts, GUIDE_STEPS, nextGuideStep } from "./guide-script";

const facts = (overrides: Partial<GuideFacts> = {}): GuideFacts => ({
  realm: true,
  barracks: false,
  troopsAtHome: 1_500,
  armies: 0,
  armyActed: false,
  camp: null,
  castleAffordable: false,
  onMap: true,
  armiesTired: false,
  pickWaiting: false,
  siteCleared: false,
  closedChest: false,
  fallenRealm: false,
  lordsSpent: false,
  ...overrides,
});

const seen = (...ids: string[]) => new Set(ids);

describe("nextGuideStep", () => {
  it("opens with the arrival, then asks for the barracks on the marked plot", () => {
    expect(nextGuideStep(facts(), seen())?.id).toBe("arrival");
    expect(nextGuideStep(facts(), seen("arrival"))?.id).toBe("build-on-the-mark");
  });

  it("skips a line the player has already answered by playing", () => {
    expect(nextGuideStep(facts({ barracks: true }), seen("arrival"))?.id).toBe("muster");
  });

  it("follows the session: reveal, a camp, home, rest", () => {
    const early = seen("arrival", "build-on-the-mark", "muster");
    expect(nextGuideStep(facts({ barracks: true, armies: 3, armyActed: true }), early)?.id).toBe("first-reveal");
    expect(nextGuideStep(facts({ armies: 3, camp: { x: 12, y: 9 } }), seen(...early, "first-reveal"))?.id).toBe(
      "a-site",
    );
    expect(nextGuideStep(facts({ armies: 3, armiesTired: true }), seen(...early, "first-reveal", "a-site"))?.id).toBe(
      "rest",
    );
  });

  it("speaks on each first as its state holds: a pick, a clear, a chest, a fallen realm, spent LORDS", () => {
    const played = seen("arrival", "build-on-the-mark", "muster", "first-reveal");
    const ready = { barracks: true, armies: 2 };
    expect(nextGuideStep(facts({ ...ready, pickWaiting: true }), played)?.id).toBe("first-pick");
    expect(nextGuideStep(facts({ ...ready, siteCleared: true }), played)).toMatchObject({
      id: "first-clear",
      mood: "pleased",
    });
    expect(nextGuideStep(facts({ ...ready, closedChest: true }), played)?.id).toBe("closed-chest");
    expect(nextGuideStep(facts({ ...ready, fallenRealm: true }), played)?.id).toBe("first-fallen-realm");
    expect(nextGuideStep(facts({ ...ready, lordsSpent: true }), played)?.id).toBe("first-lords-spent");
    // A first already seen is never spoken again.
    expect(nextGuideStep(facts({ ...ready, lordsSpent: true }), seen(...played, "first-lords-spent"))).toBeNull();
  });

  it("never mentions troops it does not know about, and is silent when all is seen", () => {
    expect(nextGuideStep(facts({ barracks: true, troopsAtHome: undefined }), seen("arrival"))).toBeNull();
    expect(nextGuideStep(facts(), seen("arrival", "build-on-the-mark", "muster"))).toBeNull();
  });

  it("offers Show me for a named place, and the realm only while the player is away from it", () => {
    const place = (id: string) => GUIDE_STEPS.find((step) => step.id === id)?.place;
    expect(canShowPlace(place("build-on-the-mark"), facts({ onMap: true }))).toBe(true);
    expect(canShowPlace(place("build-on-the-mark"), facts({ onMap: false }))).toBe(false);
    expect(canShowPlace(place("a-site"), facts())).toBe(true);
    expect(canShowPlace(place("arrival"), facts())).toBe(false);
  });
});
