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
      ["row-3", "short"],
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
    expect(why(EARLY_REALM, "row-0")).toBe("Essence 300 / 1,000");
    expect(why(EARLY_REALM, "row-1")).toBe("Build a Workshop");
    // A training building can only stand once the Barracks row is rare.
    expect(why(EARLY_REALM, "row-4")).toBe("Barracks Rare first");
    expect(why(EARLY_REALM, "reach-2")).toBe("Ethereal I first");
    expect(canResearchNow(readResearchTree(EARLY_REALM))).toBe(false);
  });

  it("locks a tier whose labor the castle's store cannot hold, naming the level that holds it", () => {
    // Barracks epic costs 24,000 labor; a City's labor store holds 18,000, a Kingdom's 50,000.
    expect(node(MID_REALM, "row-2").state).toBe("locked");
    expect(why(MID_REALM, "row-2")).toBe("Labor store 18,000 / 24,000 · a Kingdom holds it");
  });

  it("opens the training rows once the Barracks is rare, and prices each next tier from the game's prices", () => {
    const warHall = node(MID_REALM, "row-4");
    expect([warHall.state, warHall.price]).toEqual(["ready", { essence: 12_000, labor: 3_000 }]);
    expect(why(MID_REALM, "row-5")).toBe("Build a Supply yard");
    expect([node(MID_REALM, "row-0").state, node(MID_REALM, "row-0").price]).toEqual([
      "ready",
      { essence: 12_000, labor: 8_000 },
    ]);
    expect(node(MID_REALM, "shrine").state).toBe("done");
    expect(node(MID_REALM, "row-2").gate).toEqual({ tier: "Rare", met: true });
    expect(canResearchNow(readResearchTree(MID_REALM))).toBe(true);
  });

  it("gives a Farm tier's two sides their figures now and with one more pick, and the lodge its three kinds", () => {
    // Fields and Granary taken once each: +25% wheat and +50% store; one more of either adds a step.
    expect(node(MID_REALM, "row-0").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Fields", "+25%", "+50%"],
      ["Granary", "+50%", "+100%"],
    ]);
    // The lodge's uncommon went to rifts (+10%); its rare adds 20% more to the kind picked.
    expect(node(MID_REALM, "row-6").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Trolls", "0%", "+20%"],
      ["Rifts", "+10%", "+30%"],
      ["Beasts", "0%", "+20%"],
    ]);
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

  it("names the army's camp clear and its Scouting kind by the Troll", () => {
    const army = readArmyDetail({ ...VETERAN_ARMY, progress: { ...VETERAN_ARMY.progress, scoutingKinds: ["camp"] } });
    expect(army.earn.map(({ line }) => line)).toContain("Clear a Troll: more for a stronger guard");
    expect(army.attributes.find(({ key }) => key === "scouting")?.now).toBe("+10% Trolls");
    expect(JSON.stringify(army)).not.toMatch(/Camp/);
  });
});

describe("an army's detail as progression rules it", () => {
  it("reads the owner's army: 12 of the 100 XP its first level-up costs, nothing to buy yet", () => {
    const army = readArmyDetail(EARLY_ARMY);
    expect([army.goal, army.affordable]).toEqual([{ xp: 100, share: 0.12 }, 0]);
    expect(army.attributes.map(({ name, now, next }) => [name, now, next?.change])).toEqual([
      ["Battle", "0%", "0% → +10%"],
      ["Logistics", "120", "120 → 140"],
      ["Scouting", "0%", "0% · +10% on the kind you pick"],
      ["Homecoming", "0%", "0% → 3%"],
    ]);
  });

  it("prices each attribute's next level by its own level, and counts what the XP buys now", () => {
    const army = readArmyDetail(VETERAN_ARMY);
    expect(army.attributes.map(({ name, now, next }) => [name, now, next?.xp, next?.affordable])).toEqual([
      ["Battle", "+10%", 200, true],
      ["Logistics", "170", 400, false],
      ["Scouting", "+10% Rifts", 200, true],
      ["Homecoming", "0%", 100, true],
    ]);
    expect([army.affordable, army.refill]).toEqual([3, 30]);
  });
});
