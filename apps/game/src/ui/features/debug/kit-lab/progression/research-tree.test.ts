import { describe, expect, it } from "vitest";

import { readArmy } from "./army-detail";
import { EARLY_ARMY, EARLY_REALM, MID_REALM, VETERAN_ARMY } from "./progression-facts";
import { firstMissing, needLine, readResearchTree } from "./research-tree";

const node = (realm: typeof EARLY_REALM, key: string) => readResearchTree(realm).find((item) => item.key === key)!;
const why = (realm: typeof EARLY_REALM, key: string) => {
  const missing = firstMissing(node(realm, key));
  return missing && needLine(missing);
};

describe("the castle's tree as the contract rules it", () => {
  it("reads the owner's realm: every standing row short of Essence, the rest locked by the step that opens it", () => {
    expect(readResearchTree(EARLY_REALM).map(({ key, state }) => [key, state])).toEqual([
      ["farm", "short"],
      ["workshop", "locked"],
      ["hut", "short"],
      ["barracks", "short"],
      ["war-hall", "locked"],
      ["supply-yard", "locked"],
      ["scouts-lodge", "locked"],
      ["hearth", "locked"],
      ["shrine", "short"],
      ["well", "short"],
      ["reach-1", "short"],
      ["reach-2", "locked"],
      ["reach-3", "locked"],
    ]);
    expect(why(EARLY_REALM, "farm")).toBe("Essence 300 / 1,000");
    expect(why(EARLY_REALM, "workshop")).toBe("Build a Workshop");
    // A training building can only stand once the Barracks row is rare.
    expect(why(EARLY_REALM, "war-hall")).toBe("Barracks Rare first");
    expect(why(EARLY_REALM, "reach-2")).toBe("Reach I first");
  });

  it("locks a tier whose labor the castle's store cannot hold, naming the level that holds it", () => {
    // Barracks epic costs 24,000 labor; a City's labor store holds 18,000, a Kingdom's 50,000.
    expect(node(MID_REALM, "barracks").state).toBe("locked");
    expect(why(MID_REALM, "barracks")).toBe("Labor store 18,000 / 24,000 · a Kingdom holds it");
  });

  it("opens the training rows once the Barracks is rare, and prices the next tier from the preset's ladders", () => {
    const warHall = node(MID_REALM, "war-hall");
    expect([warHall.state, warHall.price]).toEqual(["ready", { essence: 12_000, labor: 3_000 }]);
    expect(why(MID_REALM, "supply-yard")).toBe("Build a Supply yard");
    expect([node(MID_REALM, "farm").state, node(MID_REALM, "farm").price]).toEqual([
      "ready",
      { essence: 12_000, labor: 8_000 },
    ]);
    expect(node(MID_REALM, "shrine").state).toBe("done");
  });

  it("gives a Farm tier's two sides their figures now and with one more pick", () => {
    // Fields and Granary taken once each: +25% wheat and +50% store, one more of either adds a step.
    expect(node(MID_REALM, "farm").sides?.map(({ name, now, next }) => [name, now, next])).toEqual([
      ["Fields", "+25%", "+50%"],
      ["Granary", "+50%", "+100%"],
    ]);
  });
});

describe("an army's detail as progression rules it", () => {
  it("reads the owner's army: 12 of the 100 XP its first level-up costs, nothing to buy yet", () => {
    const army = readArmy(EARLY_ARMY);
    expect([army.goal, army.affordable, army.stamina]).toEqual([{ xp: 100, share: 0.12 }, 0, { current: 4, max: 120 }]);
    expect(army.attributes.map(({ name, now }) => [name, now])).toEqual([
      ["Battle", "+0%"],
      ["Logistics", "120"],
      ["Scouting", "+0%"],
      ["Homecoming", "0%"],
    ]);
  });

  it("prices each attribute's next level by its own level, and counts what the XP buys now", () => {
    const army = readArmy(VETERAN_ARMY);
    expect(army.attributes.map(({ name, next }) => [name, next?.xp, next?.affordable])).toEqual([
      ["Battle", 200, true],
      ["Logistics", 400, false],
      ["Scouting", 200, true],
      ["Homecoming", 100, true],
    ]);
    expect([army.affordable, army.stamina.max]).toEqual([3, 170]);
  });
});
