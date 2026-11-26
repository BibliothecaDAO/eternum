import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";

import { EARLY_REALM, MID_REALM } from "./progression-fixture";
import {
  canResearchNow,
  firstMissing,
  needLine,
  readResearchLinks,
  readResearchTree,
  researchActionName,
  researchEffectLine,
  researchEraForLevel,
  researchVerb,
  type RealmResearchFacts,
} from "./research-tree";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { rankName } from "@bibliothecadao/types";

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
      ["row-2", "locked"],
      ["row-4", "locked"],
      ["row-6", "locked"],
      ["row-5", "locked"],
      ["well", "short"],
      ["shrine", "locked"],
      ["spire", "locked"],
    ]);
    expect(why(EARLY_REALM, "row-0")).toBe("Needs 500 Essence");
    expect(why(EARLY_REALM, "row-1")).toBe("Needs a Workshop");
    expect(why(EARLY_REALM, "row-2")).toBe("Needs City");
    expect(why(EARLY_REALM, "row-4")).toBe("Needs Kingdom");
    expect(why(EARLY_REALM, "row-5")).toBe("Needs Kingdom");
    expect(why({ ...EARLY_REALM, castleLevel: 2 }, "row-5")).toBe("Needs a Supply yard");
    expect(why(EARLY_REALM, "well")).toBe("Needs 2,500 Essence");
    expect(why(EARLY_REALM, "shrine")).toBe("Needs Well lore first");
    expect(why(EARLY_REALM, "spire")).toBe("Needs Shrine lore first");
    const wellLearned = { ...EARLY_REALM, learned: { [research.ROW_LORE]: { tier: research.LORE_WELLS } } };
    expect(why(wellLearned, "shrine")).toBe(RESEARCH_TREE.needsLevel(rankName(research.SHRINE_LORE_LEVEL)));
    expect(firstMissing(node({ ...wellLearned, castleLevel: research.SHRINE_LORE_LEVEL }, "shrine"))?.kind).toBe(
      "essence",
    );
    expect(why(MID_REALM, "spire")).toBe(RESEARCH_TREE.needsLevel(rankName(research.SPIRE_LORE_LEVEL)));
    expect(canResearchNow(readResearchTree(EARLY_REALM))).toBe(false);
  });

  it("prices Logistics from the active preset without a Barracks prerequisite", () => {
    const supplyYard = node(MID_REALM, "row-5");
    expect([supplyYard.state, supplyYard.price]).toEqual(["ready", { essence: 10_000, labor: 2_500 }]);
    expect([node(MID_REALM, "row-0").state, node(MID_REALM, "row-0").price]).toEqual([
      "ready",
      { essence: 1_000, labor: 1_000 },
    ]);
    expect([node(MID_REALM, "well").state, node(MID_REALM, "shrine").state]).toEqual(["done", "done"]);
    expect([node(MID_REALM, "spire").name, node(MID_REALM, "spire").price]).toEqual([
      "Spire lore",
      { essence: 10_000, labor: 0 },
    ]);
    expect(canResearchNow(readResearchTree(MID_REALM))).toBe(true);
  });

  it("gives a Farm tier its output figure now and with the next tier", () => {
    const farm = node(MID_REALM, "row-0");
    expect(farm.gives).toEqual({ line: "Farm wheat", now: "120%", next: "140%" });
    expect(farm.figures).toEqual([{ icon: "fields", name: "Fields", line: "Farm wheat", now: "120%", next: "140%" }]);
    expect(researchEffectLine(farm)).toBe("120% → 140%");
  });

  it("says what a finished Farm gives, with nothing left to buy", () => {
    const farm = node({ ...MID_REALM, learned: { ...MID_REALM.learned, 0: { tier: 5 } } }, "row-0");
    expect([farm.state, farm.price, farm.nextTier]).toEqual(["done", undefined, undefined]);
    expect(farm.gives).toEqual({ line: "Farm wheat", now: "200%", next: undefined });
    expect(researchEffectLine(farm)).toBe("200%");
  });
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

it("keeps every research line short enough for one line on a phone", () => {
  for (const realm of [EARLY_REALM, MID_REALM]) {
    for (const each of readResearchTree(realm)) {
      for (const line of each.figures.map((figure) => figure.line)) expect(line.length, line).toBeLessThanOrEqual(16);
    }
  }
});

it("offers independent Camp and Depot upgrades with their exact next output and wheat cost", () => {
  const realm: RealmResearchFacts = {
    ...MID_REALM,
    castleLevel: 2,
    standing: { ...MID_REALM.standing, [research.ROW_CONSCRIPTION]: 1, [research.ROW_RATIONS]: 1 },
    learned: {
      ...MID_REALM.learned,
      [research.ROW_CONSCRIPTION]: { tier: 1 },
      [research.ROW_RATIONS]: { tier: 3 },
    },
  };
  expect(node(realm, `row-${research.ROW_CONSCRIPTION}`)).toMatchObject({
    name: "Conscription Camp",
    tier: 1,
    price: { essence: 5000, labor: 1000 },
    gives: { now: "120 troops an hour", next: "140 troops an hour" },
    figures: [{ name: "Troops an hour", line: "At each Barracks", now: "120", next: "140" }],
  });
  expect(node(realm, `row-${research.ROW_RATIONS}`)).toMatchObject({
    name: "Rations Depot",
    tier: 3,
    price: { essence: 25000, labor: 5000 },
    gives: { now: "1.4 wheat per troop", next: "1.2 wheat per troop", direction: "lower" },
    figures: [{ name: "Wheat per troop", line: "On each deploy", now: "1.4", next: "1.2" }],
  });
  expect(researchEffectLine(node(realm, `row-${research.ROW_CONSCRIPTION}`))).toBe(
    `${RESEARCH_TREE.effects.troops("120")} → ${RESEARCH_TREE.effects.troops("140")}`,
  );
  expect(researchEffectLine(node(realm, `row-${research.ROW_RATIONS}`))).toBe(
    "1.4 wheat per troop → 1.2 wheat per troop (less)",
  );
  expect(researchEffectLine(node(EARLY_REALM, "well"))).toBe("None → 40% max stamina each");
  expect(researchEffectLine(node({ ...EARLY_REALM, essence: 2_500 }, "well"))).toBe("None → 40% max stamina each");
  expect(researchEffectLine(node(MID_REALM, "spire"))).toBe("Closed → Open");
});

it("shows only Knight slots at Settlement and each troop's three exact purchases at City", () => {
  const rows = [research.ROW_KNIGHT_OATHS, research.ROW_SCOUT_OATHS, research.ROW_CROSSBOW_OATHS];
  expect(
    readResearchTree(EARLY_REALM)
      .filter(({ row }) => rows.some((value) => value === row))
      .map(({ row }) => row),
  ).toEqual([research.ROW_KNIGHT_OATHS]);
  for (const row of rows) {
    const realm = { ...MID_REALM, essence: 200000, labor: 40000, laborStore: () => 80000, standing: { [row]: 1 } };
    for (let tier = 0; tier <= 3; tier++) {
      const result = node({ ...realm, learned: { [row]: { tier } } }, `row-${row}`);
      expect(result.maxTier).toBe(3);
      expect(result.gives.now).toBe(`${tier + 2} Oath slots`);
      expect(result.gives.next).toBe(tier === 3 ? undefined : `${tier + 3} Oath slots`);
      expect(result.price).toEqual(
        [{ essence: 5000, labor: 1000 }, { essence: 35000, labor: 7500 }, { essence: 150000, labor: 35000 }, undefined][
          tier
        ],
      );
      expect(result.state).toBe(tier === 3 ? "done" : "ready");
    }
  }
});

it("uses one Upgrade verb across building and oath rows while naming Oath slots explicitly", () => {
  expect(researchVerb(research.ROW_FARM)).toBe("Upgrade");
  expect(researchVerb(research.ROW_KNIGHT_OATHS)).toBe("Upgrade Oath slots");
  expect(researchActionName({ row: research.ROW_FARM, name: "Farm" })).toBe("Upgrade Farm");
  expect(researchActionName({ row: research.ROW_KNIGHT_OATHS, name: "Barracks" })).toBe("Upgrade Barracks Oath slots");
});

it("assigns every node its contract era and derives prerequisite link states from leadsTo", () => {
  expect([researchEraForLevel(-1), researchEraForLevel(0), researchEraForLevel(1), researchEraForLevel(5)]).toEqual([
    0, 0, 1, 2,
  ]);
  expect(node(MID_REALM, "row-0").era).toBe(0);
  expect(node(MID_REALM, "row-6").era).toBe(0);
  expect(node(MID_REALM, "row-2").era).toBe(1);
  expect(node(MID_REALM, "row-4").era).toBe(2);
  expect(node(MID_REALM, "row-5").era).toBe(2);
  expect([node(MID_REALM, "well").era, node(MID_REALM, "shrine").era, node(MID_REALM, "spire").era]).toEqual([0, 1, 2]);
  expect(readResearchLinks(readResearchTree(EARLY_REALM))).toEqual([
    { key: "well->shrine", from: "well", to: "shrine", state: "locked" },
    { key: "shrine->spire", from: "shrine", to: "spire", state: "locked" },
  ]);
  expect(readResearchLinks(readResearchTree(MID_REALM))).toEqual([
    { key: "well->shrine", from: "well", to: "shrine", state: "done" },
    { key: "shrine->spire", from: "shrine", to: "spire", state: "locked" },
  ]);
  expect(readResearchLinks(readResearchTree({ ...MID_REALM, castleLevel: research.SPIRE_LORE_LEVEL }))).toEqual([
    { key: "well->shrine", from: "well", to: "shrine", state: "done" },
    { key: "shrine->spire", from: "shrine", to: "spire", state: "ready" },
  ]);
});

it("gives every research node a concise shortEffect label from one source that fits phone cards without truncation", () => {
  const early = Object.fromEntries(readResearchTree(EARLY_REALM).map((item) => [item.key, item.shortEffect]));
  expect(early).toEqual({
    "row-0": "100% → 120%",
    "row-1": "100% → 120%",
    "row-2": "100 → 120/hr",
    "row-4": "2 → 1.8 wheat",
    "row-5": "180 → 216 ⚡",
    "row-6": "2 → 3 Oaths",
    well: "+40% ⚡",
    shrine: "Opens",
    spire: "Opens",
  });

  const mid = Object.fromEntries(readResearchTree(MID_REALM).map((item) => [item.key, item.shortEffect]));
  expect(mid).toMatchObject({
    "row-0": "120% → 140%",
    "row-6": "2 → 3 Oaths",
    "row-7": "2 → 3 Oaths",
    "row-11": "2 → 3 Oaths",
    "row-5": "216 → 252 ⚡",
    well: "+40% ⚡",
    shrine: "Open",
    spire: "Opens",
  });

  const maxed = readResearchTree({
    ...MID_REALM,
    learned: {
      [research.ROW_FARM]: { tier: 5 },
      [research.ROW_WORKSHOP]: { tier: 5 },
      [research.ROW_CONSCRIPTION]: { tier: 5 },
      [research.ROW_RATIONS]: { tier: 5 },
      [research.ROW_SUPPLY_YARD]: { tier: 5 },
      [research.ROW_KNIGHT_OATHS]: { tier: 3 },
      [research.ROW_SCOUT_OATHS]: { tier: 3 },
      [research.ROW_CROSSBOW_OATHS]: { tier: 3 },
      [research.ROW_LORE]: { tier: 3 },
    },
  });
  for (const item of [...readResearchTree(EARLY_REALM), ...readResearchTree(MID_REALM), ...maxed]) {
    expect(item.shortEffect.length, `${item.key}: ${item.shortEffect}`).toBeLessThanOrEqual(15);
  }
});
