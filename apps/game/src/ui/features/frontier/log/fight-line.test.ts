import { siteName } from "@bibliothecadao/types";
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
    const name = siteName(SITE);
    expect(fightLogLine(battle([154, 0], [1_100, 1_028]), store)).toBe(
      `${name}: Army lost, lost 154, guard 1,028 left`,
    );
    expect(fightLogLine(battle([500, 432], [334, 150]), store)).toBe(`${name}: Guard holds, lost 68, guard 150 left`);
    expect(fightLogLine(battle([432, 364], [150, 0]), store)).toBe(`${name}: Victory, lost 68, guard 0 left`);
  });

  it("names a camp by its site's name, including after a clear removed its structure and guard", () => {
    const { store, site } = campBeside("Camp");
    const name = siteName(SITE);
    expect(fightLogLine(battle([500, 432], [334, 150]), store)).toBe(`${name}: Guard holds, lost 68, guard 150 left`);
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward: null } },
      },
      { model: "Structure", key: "0x71", value: null },
      { model: "Guard", key: "0x73", value: null },
    ] as never);
    expect(fightLogLine(battle([432, 364], [150, 0]), store)).toBe(`${name}: Victory, lost 68, guard 0 left`);
  });

  it("leaves every other story, and a battle against no site, to their own titles", () => {
    const { store } = campBeside();
    expect(fightLogLine({ story: "ExplorationReward", storyPayload: {} }, store)).toBeNull();
    expect(fightLogLine(battle([154, 0], [1_100, 1_028], 7), store)).toBeNull();
  });
});
