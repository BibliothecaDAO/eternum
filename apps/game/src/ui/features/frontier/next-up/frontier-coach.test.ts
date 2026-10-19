import { describe, expect, it } from "vitest";

import type { NextUpFacts } from "./next-up-facts";
import { frontierCoachSteps } from "./frontier-coach";

/** A realm on its first morning: no barracks, troops at home, no army out. */
const MORNING: NextUpFacts = {
  realm: true,
  barracks: false,
  troopsAtHome: 1_500,
  armies: 0,
  armyTierAffordable: false,
  camp: null,
  castleAffordable: false,
  typeTierAffordable: null,
  armiesTired: false,
  storeFull: null,
  populationFull: false,
  armySelected: false,
  guardInReach: false,
  lastHour: false,
  rules: {
    hutAdds: 6,
    stamina: { explore: 30, anHour: 30 },
    xp: { reveal: 2 },
    homecomingPercent: 3,
  },
};

const lines = (facts: Partial<NextUpFacts>, pointer: "mouse" | "touch" = "mouse") =>
  frontierCoachSteps({ ...MORNING, ...facts }, { pointer, tips: true }).map(({ line, verb, act }) => [line, verb, act]);

describe("Frontier's Next up", () => {
  it("starts a realm's first morning with barracks, then the deploy, each with its button", () => {
    expect(lines({})).toEqual([
      ["Build barracks: only barracks train troops for your armies.", "Open the realm", "realm"],
      ["Deploy your armies: one strong army, two scouts. They stay out until the day ends.", "Deploy", "deploy"],
    ]);
  });

  it("sends an army exploring, then says how on the map once it is selected, with the rules' numbers", () => {
    const out = { barracks: true, armies: 2 };
    expect(lines(out)).toEqual([
      [
        "Your army can explore: each new tile sends Essence or labor home and gives 2 XP.",
        "Select the army",
        "select-army",
      ],
    ]);
    expect(lines({ ...out, armySelected: true })).toEqual([
      [
        "Right-click a tile beside your army to explore it (30 stamina): each new tile sends Essence or labor home and gives 2 XP.",
        null,
        null,
      ],
    ]);
    expect(lines({ ...out, armySelected: true }, "touch")[0][0]).toMatch(/^Hold a tile beside your army/);
  });

  it("puts the day's alerts first: the last hour, a full store, no population", () => {
    const keys = frontierCoachSteps(
      { ...MORNING, barracks: true, lastHour: true, storeFull: "wheat", populationFull: true },
      { pointer: "mouse", tips: true },
    ).map(({ key }) => key);
    expect(keys).toEqual(["frontier:last-hour", "frontier:store-full", "frontier:population-full", "frontier:deploy"]);
    expect(lines({ barracks: true, lastHour: true })[0][0]).toBe(
      "The day ends within the hour, and armies still out end with it. Homecoming sends 3% of their troops home.",
    );
  });

  it("offers what can be taken now before exploring: a guard, the army's tier, the castle, a research tier", () => {
    const keys = frontierCoachSteps(
      {
        ...MORNING,
        barracks: true,
        armies: 1,
        guardInReach: true,
        camp: { x: 4, y: 9 },
        armyTierAffordable: true,
        castleAffordable: true,
        typeTierAffordable: "Farm",
      },
      { pointer: "mouse", tips: true },
    ).map(({ key }) => key);
    // What can be taken now leads; exploring, the day's loop, follows, then the camp it heads for.
    expect(keys).toEqual([
      "frontier:guard",
      "frontier:army-tier",
      "frontier:castle",
      "frontier:research",
      "frontier:explore",
      "frontier:camp",
    ]);
  });

  it("tells armies out of stamina to rest instead of exploring, and says nothing without a realm", () => {
    expect(lines({ barracks: true, armies: 2, armiesTired: true })).toEqual([
      ["Your armies are out of stamina: 30 come back each hour, while you are away too.", null, null],
    ]);
    expect(lines({ realm: false })).toEqual([]);
  });

  it("holds the alerts alone with tips off", () => {
    const keys = (tips: boolean) =>
      frontierCoachSteps({ ...MORNING, lastHour: true, storeFull: "wheat" }, { pointer: "mouse", tips }).map(
        ({ key }) => key,
      );
    expect(keys(false)).toEqual(["frontier:last-hour", "frontier:store-full"]);
    expect(keys(true)).toEqual(["frontier:last-hour", "frontier:store-full", "frontier:barracks", "frontier:deploy"]);
  });

  it("states a line without its number while the rules are unknown", () => {
    expect(lines({ barracks: true, armies: 1, rules: null })[0][0]).toBe(
      "Your army can explore: each new tile sends Essence or labor home and gives XP.",
    );
  });
});
