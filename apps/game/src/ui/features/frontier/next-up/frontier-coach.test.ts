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
};

const lines = (facts: Partial<NextUpFacts>, pointer: "mouse" | "touch" = "mouse", where: "realm" | "map" = "map") =>
  frontierCoachSteps({ ...MORNING, ...facts }, { pointer, where, tips: true }).map(({ line, verb, act }) => [
    line,
    verb,
    act,
  ]);

describe("Frontier's Next up", () => {
  it("starts a realm's first morning with barracks, then the deploy, each with its button", () => {
    expect(lines({})).toEqual([
      ["Build barracks", "Open the realm", "realm"],
      ["Deploy your armies", "Deploy", "deploy"],
    ]);
  });

  it("says in the realm what to do there, where the map offers the way in, and offers no button that goes nowhere", () => {
    expect(lines({}, "mouse", "realm")[0]).toEqual(["Click an open plot for Barracks", null, null]);
    expect(lines({}, "touch", "realm")[0][0]).toBe("Tap an open plot for Barracks");
    expect(lines({ barracks: true, armies: 1, populationFull: true }, "mouse", "realm")[0]).toEqual([
      "Click an open plot for a Hut",
      null,
      null,
    ]);
    expect(lines({ barracks: true, armies: 1, castleAffordable: true }, "mouse", "realm")[0]).toEqual([
      "Click your castle to grow it",
      null,
      null,
    ]);
    // In the realm every remaining button goes somewhere: none of them is the realm itself.
    const inRealm = frontierCoachSteps(
      { ...MORNING, populationFull: true, castleAffordable: true },
      { pointer: "mouse", where: "realm", tips: true },
    );
    expect(inRealm.filter((step) => step.act === "realm")).toEqual([]);
  });

  it("sends an army exploring, then says how on the map once it is selected", () => {
    const out = { barracks: true, armies: 2 };
    expect(lines(out)).toEqual([["Your army can explore", "Select the army", "select-army"]]);
    expect(lines({ ...out, armySelected: true })).toEqual([["Click a tile beside your army", null, null]]);
    expect(lines({ ...out, armySelected: true }, "touch")[0][0]).toBe("Hold a tile beside your army");
  });

  it("puts the day's alerts first: the last hour, a full store, no population", () => {
    const keys = frontierCoachSteps(
      { ...MORNING, barracks: true, lastHour: true, storeFull: "wheat", populationFull: true },
      { pointer: "mouse", where: "map", tips: true },
    ).map(({ key }) => key);
    expect(keys).toEqual(["frontier:last-hour", "frontier:store-full", "frontier:population-full", "frontier:deploy"]);
    expect(lines({ barracks: true, lastHour: true })[0][0]).toBe("The day ends within the hour");
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
      { pointer: "mouse", where: "map", tips: true },
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
      ["Your armies are out of stamina", null, null],
    ]);
    expect(lines({ realm: false })).toEqual([]);
  });

  it("holds the alerts alone with tips off", () => {
    const keys = (tips: boolean) =>
      frontierCoachSteps(
        { ...MORNING, lastHour: true, storeFull: "wheat" },
        { pointer: "mouse", where: "map", tips },
      ).map(({ key }) => key);
    expect(keys(false)).toEqual(["frontier:last-hour", "frontier:store-full"]);
    expect(keys(true)).toEqual(["frontier:last-hour", "frontier:store-full", "frontier:barracks", "frontier:deploy"]);
  });
});
