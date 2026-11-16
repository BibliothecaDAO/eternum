import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";

import { EARLY_REALM, MID_REALM } from "./progression-fixture";
import { canResearchNow, firstMissing, needLine, readResearchTree, type RealmResearchFacts } from "./research-tree";

const node = (realm: RealmResearchFacts, key: string) => readResearchTree(realm).find((item) => item.key === key)!;
const why = (realm: RealmResearchFacts, key: string) => {
  const missing = firstMissing(node(realm, key));
  return missing && needLine(missing);
};

describe("the castle's tree as the contract rules it", () => {
  it("reads the owner's realm: every standing row short of Essence, the rest locked by the step that opens it", () => {
    expect(readResearchTree(EARLY_REALM).map(({ key, state }) => [key, state])).toEqual([
      ["row-0", "short"],
      ["row-1", "locked"],
      ["row-3", "ready"],
      ["row-2", "locked"],
      ["row-4", "locked"],
      ["row-5", "locked"],
      ["shrine", "short"],
      ["well", "short"],
      ["reach-1", "short"],
      ["reach-2", "locked"],
      ["reach-3", "locked"],
    ]);
    expect(why(EARLY_REALM, "row-0")).toBe("Essence 300 / 500");
    expect(why(EARLY_REALM, "row-1")).toBe("Build a Workshop");
    expect(why(EARLY_REALM, "row-5")).toBe("Build a Supply yard");
    expect(why(EARLY_REALM, "reach-2")).toBe("Ethereal I first");
    expect(canResearchNow(readResearchTree(EARLY_REALM))).toBe(true);
  });

  it("prices Logistics from the active preset without a Barracks prerequisite", () => {
    const supplyYard = node(MID_REALM, "row-5");
    expect([supplyYard.state, supplyYard.price]).toEqual(["ready", { essence: 16_000, labor: 3_000 }]);
    expect([node(MID_REALM, "row-0").state, node(MID_REALM, "row-0").price]).toEqual([
      "ready",
      { essence: 1_000, labor: 1_000 },
    ]);
    expect(node(MID_REALM, "shrine").state).toBe("done");
    expect(canResearchNow(readResearchTree(MID_REALM))).toBe(true);
  });

  it("gives a Farm tier's two sides their figures now and with one more pick", () => {
    // Fields and Granary taken once each: +25% wheat and +50% store; one more of either adds a step.
    expect(node(MID_REALM, "row-0").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Fields", "+20%", "+40%"],
      ["Granary", "+40%", "+80%"],
    ]);
  });

  it("says what a finished Farm's picks give, read from its two sides", () => {
    // Both Farm sides are complete: four Fields picks and four Granary picks.
    const legendary = {
      ...MID_REALM,
      learned: { ...MID_REALM.learned, 0: { tier: 5, sides: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] } },
    };
    const farm = node(legendary, "row-0");
    expect(farm.state).toBe("done");
    expect(farm.sides?.map((side) => side.state)).toEqual(["done", "done"]);
    expect(farm.gives).toEqual({ line: "Fields +100%", now: "Granary +200%" });
  });
});

it("keeps the cheaper side open after the other reaches Legendary and displays the highest tier", () => {
  const realm = { ...MID_REALM, learned: { ...MID_REALM.learned, 0: { tier: 5, sides: [0, 0, 0, 0, 0] } } };
  const farm = node(realm, "row-0");
  expect(farm).toMatchObject({ tier: 5, state: "ready", price: { essence: 500, labor: 500 } });
  expect(farm.sides?.map(({ tier, state }) => [tier, state])).toEqual([
    [5, "done"],
    [0, "ready"],
  ]);
  expect(
    node({ ...realm, learned: { ...realm.learned, 0: { tier: 5, sides: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] } } }, "row-0")
      .state,
  ).toBe("done");
});

it("requires construction for the first training level, with no separate research purchase", () => {
  for (const row of [research.ROW_SUPPLY_YARD, research.ROW_CONSCRIPTION, research.ROW_RATIONS]) {
    const training = node(EARLY_REALM, `row-${row}`);
    expect(training.price).toBeUndefined();
    expect(training.nextTier).toBe(1);
    expect(training.needs.some((need) => need.kind === "stands" && !need.met)).toBe(true);
    expect(training.needs.some((need) => need.kind === "labor" || need.kind === "essence")).toBe(false);
    expect(training.state).toBe("locked");
  }
});

// Owner, 30 October 2026: "bit loo long on mobile as well". A side's or figure's line stands on one line in a phone's
// side button (measured at 390 px: "Barracks troops" and "Wheat per troop" fit), the gate's in one short line.
it("keeps every research line short enough for one line on a phone", () => {
  for (const realm of [EARLY_REALM, MID_REALM]) {
    for (const each of readResearchTree(realm)) {
      for (const line of [...(each.sides ?? []), ...each.figures].map((figure) => figure.line))
        expect(line.length, line).toBeLessThanOrEqual(16);
    }
  }
});

it("offers independent Camp and Depot upgrades with their exact next output and wheat cost", () => {
  const realm: RealmResearchFacts = {
    ...MID_REALM,
    castleLevel: 2,
    standing: {...MID_REALM.standing, [research.ROW_CONSCRIPTION]: 1, [research.ROW_RATIONS]: 1},
    learned: {...MID_REALM.learned, [research.ROW_CONSCRIPTION]: {tier: 1, sides: []}, [research.ROW_RATIONS]: {tier: 3, sides: []}},
  };
  expect(node(realm, `row-${research.ROW_CONSCRIPTION}`)).toMatchObject({
    name: "Conscription Camp", tier: 1, price: {essence: 5000, labor: 1000},
    gives: {now: "120 an hour", next: "140 an hour"},
  });
  expect(node(realm, `row-${research.ROW_RATIONS}`)).toMatchObject({
    name: "Rations Depot", tier: 3, price: {essence: 25000, labor: 5000},
    gives: {now: "1.4 wheat a troop", next: "1.2 wheat a troop"},
  });
});
