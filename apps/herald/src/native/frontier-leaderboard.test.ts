import { describe, expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { buildFrontierLeaderboard } from "./frontier-leaderboard";
import { LordsAllowanceAlerts } from "./lords-allowance-alert";
import type { FoldRow } from "../types";

const amounts = { common: 100, uncommon: 400, rare: 1500, epic: 6000 };
function facts(depths = [2], committed = 0) {
  const rows: Record<string, FoldRow[]> = {};
  const add = (model: string, value: Record<string, unknown>) =>
    (rows[model] ??= []).push({ key: String(rows[model]?.length), value: { game_id: "1", ...value } });
  add("GameRegistry", { start_main_at: 100 * 86400 + 10 });
  add("SliceRules", { epoch_seconds: 86400 });
  add("ChestRules", { lords_amounts: amounts, lords_pool: 1_000_000, season_epochs: 70 });
  add("LordsBudget", { lords_committed: committed });
  depths.forEach((depth, i) =>
    add("Structure", { entity_id: i + 1, owner: i + 10, base: { category: 1 }, metadata: { deepest_depth: depth } }),
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
const clear = (kind: string, index: number, owner = 10) =>
  story(
    "SitePayout",
    {
      kind,
      reward:
        kind === "FallenRealm"
          ? null
          : { resource_type: kind === "Camp" ? 23 : 38, amount: kind === "Camp" ? "500000000000" : "3000000000000" },
    },
    index,
    owner,
  );

describe("Frontier season standings", () => {
  it("prices all four Token rarities from the pinned table and counts relics without money", () => {
    const { read, rows } = facts();
    for (let quality = 0; quality < 4; quality++) {
      const token = story("ChestReward", { kind: "Token", quality }, 0);
      const relic = story("ChestReward", { kind: "Relic", quality, lords_exhausted: true }, 1);
      const [entry] = buildFrontierLeaderboard(read, "1", [token, relic]).entries;
      expect(entry.rewards.lords).toBe(String(Object.values(amounts)[quality]));
      expect(entry.chests_earned).toBe(2);
    }
    rows.ChestRules[0].value.lords_amounts = { ...amounts, rare: 1700 };
    expect(
      buildFrontierLeaderboard(read, "1", [story("ChestReward", { kind: "Token", quality: 2 }, 0)]).entries[0].rewards
        .lords,
    ).toBe("1700");
  });

  it("counts 3 camps, a rift and a fallen realm from stories after site deletion; duplicates and order do not change it", () => {
    const { read } = facts();
    const history = [
      clear("Camp", 0),
      clear("Camp", 1),
      clear("Camp", 2),
      clear("Rift", 3),
      clear("FallenRealm", 4),
      story("ExplorationReward", { resource_type: 38, amount: "6000000000000" }, 5),
    ];
    const board = buildFrontierLeaderboard(read, "1", history);
    expect(board.entries[0]).toMatchObject({
      structure_id: "1",
      deepest_depth: 2,
      sites_cleared: { total: 5, camps: 3, rifts: 1, fallen_realms: 1 },
      rewards: { lords: "0", labor: "1500000000000", essence: "9000000000000" },
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

  it("refuses unknown kinds, qualities, missing presets and orphan rewards", () => {
    const { read, rows } = facts();
    for (const [kind, quality] of [
      ["Reserved", 0],
      ["Token", 4],
    ] as const)
      expect(() => buildFrontierLeaderboard(read, "1", [story("ChestReward", { kind, quality }, 0)])).toThrow();
    expect(() => buildFrontierLeaderboard(read, "1", [clear("Camp", 0, 999)])).toThrow("settled realm");
    delete rows.ChestRules;
    expect(() => buildFrontierLeaderboard(read, "1", [])).toThrow("ChestRules");
  });
});

describe("confirmed LORDS allowance warnings", () => {
  it("uses the absolute start offset, cumulative roll-forward, day boundary and final cap", () => {
    const warnings: unknown[] = [];
    const alerts = new LordsAllowanceAlerts((w) => warnings.push(w));
    const { read, rows } = facts([], 11427);
    alerts.observe(read, 100 * 86400 + 10);
    expect(warnings).toEqual([]);
    rows.LordsBudget[0].value.lords_committed = 11428;
    alerts.observe(read, 100 * 86400 + 10);
    alerts.observe(read, 101 * 86400 - 1);
    expect(warnings).toEqual([
      expect.objectContaining({
        absolute_epoch: 100,
        season_day: 0,
        committed: "11428",
        allowance: "14285",
        remaining: "2857",
      }),
    ]);
    alerts.observe(read, 101 * 86400);
    expect(warnings).toHaveLength(1);
    for (const [day, committed, allowance] of [
      [34, 400000, "500000"],
      [69, 800000, "1000000"],
      [90, 1000000, "1000000"],
    ] as const) {
      rows.LordsBudget[0].value.lords_committed = committed;
      alerts.observe(read, (100 + day) * 86400);
      expect(warnings.at(-1)).toMatchObject({ season_day: day, allowance });
    }
    expect(warnings).toHaveLength(4);
  });

  it("does not alert before start, validates the budget, and keeps games independent", () => {
    const warnings: unknown[] = [];
    const alerts = new LordsAllowanceAlerts((w) => warnings.push(w));
    const { read, rows } = facts([], 14285);
    alerts.observe(read, 100 * 86400 + 9);
    expect(warnings).toEqual([]);
    alerts.observe(read, 100 * 86400 + 10);
    for (const values of Object.values(rows)) for (const row of values) row.value.game_id = "2";
    alerts.observe(read, 100 * 86400 + 10);
    expect(warnings).toHaveLength(2);
    rows.LordsBudget[0].value.lords_committed = 14286;
    expect(() => new LordsAllowanceAlerts().observe(read, 100 * 86400 + 10)).toThrow("exceeds allowance");
  });
});
