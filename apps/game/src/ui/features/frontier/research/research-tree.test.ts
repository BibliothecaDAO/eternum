import { describe, expect, it } from "vitest";

import { readArmyDetail } from "../army/army-detail";
import { EARLY_ARMY, EARLY_REALM, MID_REALM, VETERAN_ARMY } from "./progression-fixture";
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
      ["row-2", "short"],
      ["row-4", "locked"],
      ["row-5", "locked"],
      ["row-6", "locked"],
      ["row-7", "locked"],
      ["shrine", "short"],
      ["well", "short"],
      ["reach-1", "short"],
      ["reach-2", "locked"],
      ["reach-3", "locked"],
    ]);
    expect(why(EARLY_REALM, "row-0")).toBe("Essence 300 / 500");
    expect(why(EARLY_REALM, "row-1")).toBe("Build a Workshop");
    // A training building can only stand once the Barracks row is rare.
    expect(why(EARLY_REALM, "row-4")).toBe("Barracks 2 purchases first");
    expect(why(EARLY_REALM, "reach-2")).toBe("Ethereal I first");
    expect(canResearchNow(readResearchTree(EARLY_REALM))).toBe(true);
  });

  it("locks a tier whose labor the castle's store cannot hold, naming the level that holds it", () => {
    // Barracks epic costs 24,000 labor; a City's labor store holds 18,000, a Kingdom's 50,000.
    const barracks = node(MID_REALM, "row-2");
    expect(barracks.state).toBe("ready");
    expect(barracks.sides?.[0].state).toBe("ready");
    expect(barracks.sides?.[0].price).toEqual({ essence: 16000, labor: 9000 });
    expect(barracks.sides?.[1]).toMatchObject({ state: "ready", price: { essence: 2000, labor: 1500 } });
  });

  it("opens the training rows once the Barracks is rare, and prices each next tier from the game's prices", () => {
    const warHall = node(MID_REALM, "row-4");
    expect([warHall.state, warHall.price]).toEqual(["ready", { essence: 16_000, labor: 3_000 }]);
    expect(why(MID_REALM, "row-5")).toBe("Build a Supply yard");
    expect([node(MID_REALM, "row-0").state, node(MID_REALM, "row-0").price]).toEqual([
      "ready",
      { essence: 1_000, labor: 1_000 },
    ]);
    expect(node(MID_REALM, "shrine").state).toBe("done");
    expect(node(MID_REALM, "row-2").gate).toEqual({ name: "Barracks 2 purchases", met: true });
    expect(canResearchNow(readResearchTree(MID_REALM))).toBe(true);
  });

  it("gives a Farm tier's two sides their figures now and with one more pick, and the lodge its three kinds", () => {
    // Fields and Granary taken once each: +25% wheat and +50% store; one more of either adds a step.
    expect(node(MID_REALM, "row-0").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Fields", "+20%", "+40%"],
      ["Granary", "+40%", "+80%"],
    ]);
    // The lodge's uncommon went to rifts (+10%); its rare adds 20% more to the kind picked.
    expect(node(MID_REALM, "row-6").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Trolls", "0%", "+15%"],
      ["Rifts", "+10%", "+25%"],
      ["Beasts", "0%", "+15%"],
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

describe("Frontier's camp is its Troll on the progression views (the shared structure naming rule)", () => {
  it("names the Scouts' lodge's camp kind Trolls, and nothing in the tree Camp", () => {
    const lodge = node(MID_REALM, "row-6");
    expect(lodge.sides?.[0]?.name).toBe("Trolls");
    expect(lodge.sides?.[0]?.line).toBe("Trolls found by new armies");
    // Internal keys and icons stay "camp"; no word a player reads says Camp.
    expect(JSON.stringify(readResearchTree(MID_REALM))).not.toMatch(/Camp/);
  });

  it("names the army's Scouting kind by the Troll", () => {
    const army = readArmyDetail({ ...VETERAN_ARMY, progress: { ...VETERAN_ARMY.progress, scoutingKinds: ["camp"] } });
    expect(army.attributes.find(({ key }) => key === "scouting")?.now).toBe("+10% discovery on Trolls");
    expect(JSON.stringify(army)).not.toMatch(/Camp/);
  });
});

describe("an army's detail as progression rules it", () => {
  it("reads the owner's army: 12 of the 100 XP its first level-up costs, nothing to buy yet", () => {
    const army = readArmyDetail(EARLY_ARMY);
    expect([army.goal, army.available]).toEqual([{ rank: 1, at: 100, from: 0, share: 0.12 }, 0]);
    expect(army.attributes.map(({ name, now, next }) => [name, now, next?.change])).toEqual([
      ["Battle", "0% damage", "0% → +10% damage"],
      ["Logistics", "120 max stamina", "120 → 140 max stamina"],
      ["Scouting", "0% discovery", "0% discovery · +10% on the kind you pick"],
      ["Homecoming", "0% come home", "0% → 3% come home"],
    ]);
  });

  it("prices each attribute's next level by its own level, and counts what the XP buys now", () => {
    const army = readArmyDetail(VETERAN_ARMY);
    expect(army.attributes.map(({ name, next }) => [name, next?.point])).toEqual([
      ["Battle", 3],
      ["Logistics", 1],
      ["Scouting", 1],
      ["Homecoming", 1],
    ]);
    expect(army.available).toBe(2);
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
  for (const row of [4, 5, 6, 7]) {
    const training = node(EARLY_REALM, `row-${row}`);
    expect(training.price).toBeUndefined();
    expect(training.nextTier).toBe(1);
    expect(training.needs.some((need) => need.kind === "stands" && !need.met)).toBe(true);
    expect(training.needs.some((need) => need.kind === "labor" || need.kind === "essence")).toBe(false);
    expect(training.state).toBe("locked");
  }
});
