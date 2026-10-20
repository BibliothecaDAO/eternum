import { describe, expect, it } from "vitest";

import { campBeside, SITE } from "../sites/site-fixture";
import { fightLogLine } from "./fight-line";

const troops = (whole: number) => String(BigInt(whole) * 1_000_000_000n);
const battle = (army: [number, number], guard: [number, number], defenderId = SITE) => ({
  story: "BattleEvent",
  storyPayload: {
    attacker_id: 201,
    defender_id: defenderId,
    attacker: { before: troops(army[0]), after: troops(army[1]) },
    defender: { before: troops(guard[0]), after: troops(guard[1]) },
  },
});

describe("the day log's line for a fight", () => {
  it("names the site, how the attack ended, the troops it cost and the guard before and after", () => {
    const { store } = campBeside("Rift");
    expect(fightLogLine(battle([154, 0], [1_100, 1_028]), store)).toBe(
      "Dark fey Rift: Army lost, lost 154, guard 1,100 to 1,028",
    );
    expect(fightLogLine(battle([500, 432], [334, 150]), store)).toBe(
      "Dark fey Rift: Guard holds, lost 68, guard 334 to 150",
    );
    expect(fightLogLine(battle([432, 364], [150, 0]), store)).toBe("Dark fey Rift: Victory, lost 68, guard 150 to 0");
  });

  it("names a camp by its Troll once, including after a clear", () => {
    const { store, site } = campBeside("Camp");
    expect(fightLogLine(battle([500, 432], [334, 150]), store)).toBe("Troll: Guard holds, lost 68, guard 334 to 150");
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward: null } },
      },
    ]);
    expect(fightLogLine(battle([432, 364], [150, 0]), store)).toBe("Troll: Victory, lost 68, guard 150 to 0");
  });

  it("leaves every other story, and a battle against no site, to their own titles", () => {
    const { store } = campBeside();
    expect(fightLogLine({ story: "ExplorationReward", storyPayload: {} }, store)).toBeNull();
    expect(fightLogLine(battle([154, 0], [1_100, 1_028], 7), store)).toBeNull();
  });
});
