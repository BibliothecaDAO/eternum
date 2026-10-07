import { describe, expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { buildFrontierLeaderboard } from "./frontier-leaderboard";
import { LordsCeilingAlerts } from "./lords-ceiling-alert";
import type { FoldRow } from "../types";

function facts(depths = [2], spent = 0) {
  const rows: Record<string, FoldRow[]> = {};
  const add = (model: string, value: Record<string, unknown>) =>
    (rows[model] ??= []).push({ key: String(rows[model]?.length), value: { game_id: "1", ...value } });
  add("GameRegistry", { start_main_at: 100 * 86400 + 10 });
  add("LordsBudget", { pool_left: 990_000, spent, ceiling: 3_000, day: 100 });
  depths.forEach((depth, i) =>
    add("Structure", {
      entity_id: i + 1,
      owner: i + 10,
      base: { category: 1 },
      metadata: { deepest_depth: depth, order: i + 3 },
    }),
  );
  return { rows, read: (model: string) => rows[model] ?? [] };
}
function story(name: string, value: Record<string, unknown>, index: number, owner = 10): HeraldHistoryEvent {
  return {
    game_id: "1",
    model: "StoryEvent",
    block_number: 100,
    transaction_index: 0,
    event_index: index,
    transaction_hash: "0x55",
    value: { owner, story: { [name]: value } },
  };
}
const CATEGORY = { Camp: 7, Rift: 9, Ruin: 10, Stragglers: 11 } as const;
const REWARD = {
  Camp: { resource_type: 23, amount: "500000000000" },
  Rift: { resource_type: 38, amount: "3000000000000" },
  Ruin: { resource_type: 37, amount: "200000000000" },
  Stragglers: null,
} as const;
const clear = (kind: keyof typeof CATEGORY, index: number, owner = 10) =>
  story("SitePayout", { category: CATEGORY[kind], reward: REWARD[kind] }, index, owner);

describe("Frontier season standings", () => {
  it("counts a ruin's clear as its chest and its stored LORDS in whole units", () => {
    const { read } = facts();
    const [entry] = buildFrontierLeaderboard(read, "1", [clear("Ruin", 0), clear("Ruin", 1)]).entries;
    expect(entry.chests_earned).toBe(2);
    expect(entry.rewards.lords).toBe("400");
  });

  it("counts 3 camps, a rift, a ruin and stragglers from stories after site deletion; duplicates and order do not change it", () => {
    const { read } = facts();
    const history = [
      clear("Camp", 0),
      clear("Camp", 1),
      clear("Camp", 2),
      clear("Rift", 3),
      clear("Ruin", 4),
      clear("Stragglers", 6),
      story("ExplorationReward", { resource_type: 38, amount: "6000000000000" }, 5),
    ];
    const board = buildFrontierLeaderboard(read, "1", history);
    expect(board.entries[0]).toMatchObject({
      structure_id: "1",
      deepest_depth: 2,
      order: 3,
      sites_cleared: { total: 6, camps: 3, rifts: 1, ruins: 1, stragglers: 1 },
      chests_earned: 1,
      rewards: { lords: "200", labor: "1500000000000", essence: "9000000000000" },
    });
    expect(buildFrontierLeaderboard(read, "1", [...history, ...history].reverse())).toEqual(board);
  });

  it("ranks count, current depth, then the receipt that reached the count, with stable address ties", () => {
    const { read } = facts([1, 2, 2, 0, 0]);
    const history = [clear("Camp", 1, 10), clear("Camp", 2, 10), clear("Camp", 0, 12), clear("Camp", 3, 11)];
    expect(buildFrontierLeaderboard(read, "1", history).entries.map((e) => e.address)).toEqual([
      "0xa",
      "0xc",
      "0xb",
      "0xd",
      "0xe",
    ]);
  });

  it("refuses unknown site categories, unknown stories, missing games and orphan rewards", () => {
    const { read, rows } = facts();
    expect(() => buildFrontierLeaderboard(read, "1", [story("SitePayout", { category: 4, reward: null }, 0)])).toThrow(
      "not a guarded site",
    );
    expect(() => buildFrontierLeaderboard(read, "1", [story("ChestReward", { quality: 0 }, 0)])).toThrow(
      "Unexpected Frontier leaderboard story",
    );
    expect(() => buildFrontierLeaderboard(read, "1", [clear("Camp", 0, 999)])).toThrow("settled realm");
    delete rows.GameRegistry;
    expect(() => buildFrontierLeaderboard(read, "1", [])).toThrow("GameRegistry");
  });
});

describe("confirmed LORDS ceiling warnings", () => {
  it("warns once a day when its chests reach 80% of the surge ceiling", () => {
    const warnings: unknown[] = [];
    const alerts = new LordsCeilingAlerts((w) => warnings.push(w));
    const { read, rows } = facts([], 2_399);
    alerts.observe(read);
    expect(warnings).toEqual([]);
    rows.LordsBudget[0].value.spent = 2_400;
    alerts.observe(read);
    alerts.observe(read);
    expect(warnings).toEqual([
      expect.objectContaining({ day: "100", spent: "2400", ceiling: "3000", pool_left: "990000" }),
    ]);
    rows.LordsBudget[0].value.day = 101;
    alerts.observe(read);
    expect(warnings).toHaveLength(2);
  });

  it("keeps games independent and refuses chests past the ceiling", () => {
    const warnings: unknown[] = [];
    const alerts = new LordsCeilingAlerts((w) => warnings.push(w));
    const { read, rows } = facts([], 3_000);
    alerts.observe(read);
    for (const values of Object.values(rows)) for (const row of values) row.value.game_id = "2";
    alerts.observe(read);
    expect(warnings).toHaveLength(2);
    rows.LordsBudget[0].value.spent = 3_001;
    expect(() => new LordsCeilingAlerts().observe(read)).toThrow("exceed the day's ceiling");
  });
});
