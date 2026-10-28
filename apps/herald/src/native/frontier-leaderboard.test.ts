import { describe, expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { buildFrontierLeaderboard } from "./frontier-leaderboard";
import type { FoldRow } from "../types";

function facts(depths = [2]) {
  const rows: Record<string, FoldRow[]> = {};
  const add = (model: string, value: Record<string, unknown>) =>
    (rows[model] ??= []).push({ key: String(rows[model]?.length), value: { game_id: "1", ...value } });
  add("GameRegistry", { start_main_at: 100 * 86400 + 10 });
  depths.forEach((depth, i) =>
    add("Structure", {
      entity_id: i + 1,
      owner: i + 10,
      base: { category: 1, level: i % 4 },
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
const CATEGORY = { Camp: 7, Rift: 9, Ruin: 10, Beasts: 11 } as const;
const REWARD = {
  Camp: { resource_type: 23, amount: "500000000000" },
  Rift: { resource_type: 38, amount: "3000000000000" },
  Ruin: { resource_type: 37, amount: "200000000000" },
  Beasts: null,
} as const;
const clear = (kind: keyof typeof CATEGORY, index: number, owner = 10) =>
  story("SitePayout", { category: CATEGORY[kind], reward: REWARD[kind] }, index, owner);

describe("Frontier season standings", () => {
  it("includes each home's campaign identity from the complete game, including ordinary homes", () => {
    const { read, rows } = facts([0, 0, 0]);
    rows.CampaignHome = [
      { key: "regular", value: { game_id: "1", home: "0x1", campaign_id: "0x123", tier: 1 } },
      { key: "golden", value: { game_id: "1", home: "2", campaign_id: "0x123", tier: 2 } },
      { key: "other-game", value: { game_id: "2", home: "3", campaign_id: "0x456", tier: 2 } },
    ];
    expect(
      buildFrontierLeaderboard(read, "1", []).entries.map(({ structure_id, campaign }) => ({ structure_id, campaign })),
    ).toEqual([
      { structure_id: "1", campaign: { campaign_id: "291", tier: 1 } },
      { structure_id: "2", campaign: { campaign_id: "291", tier: 2 } },
      { structure_id: "3", campaign: null },
    ]);
  });

  it.each([50, 0])("counts a %s LORDS exploration chest once without a site clear", (amount) => {
    const { read } = facts();
    const opening = story(
      "RewardChestOpened",
      {
        explorer_id: 7,
        structure_id: 1,
        coord: { alt: false, x: 40, y: 12 },
        amount,
      },
      0,
    );
    const board = buildFrontierLeaderboard(read, "1", [opening, opening]);
    expect(board.entries[0]).toMatchObject({
      chests_earned: 1,
      rewards: { lords: String(amount), labor: "0", essence: "0" },
      sites_cleared: { total: 0, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
    });
    expect(buildFrontierLeaderboard(read, "1", [opening])).toEqual(board);
  });

  it("adds whole chest LORDS to precision-scaled ruin payouts without changing any clear ranking", () => {
    const { read } = facts([1, 2, 2, 0, 0]);
    const clears = [clear("Ruin", 1, 10), clear("Camp", 2, 10), clear("Camp", 0, 12), clear("Camp", 3, 11)];
    const before = buildFrontierLeaderboard(read, "1", clears);
    const receipts = [
      ...clears,
      story("RewardChestOpened", { amount: "50" }, 4, 10),
      story("RewardChestOpened", { amount: "99999999999999999999" }, 5, 14),
      story("RewardChestOpened", { amount: 0 }, 6, 11),
      story("RewardChestOpened", { amount: 25 }, 7, 12),
    ];
    const after = buildFrontierLeaderboard(read, "1", [...receipts, ...receipts].reverse());
    expect(after.entries.map(({ address, rank, sites_cleared }) => ({ address, rank, sites_cleared }))).toEqual(
      before.entries.map(({ address, rank, sites_cleared }) => ({ address, rank, sites_cleared })),
    );
    expect(after.entries.find((entry) => entry.address === "0xa")).toMatchObject({
      chests_earned: 2,
      rewards: { lords: "250" },
    });
    expect(after.entries.find((entry) => entry.address === "0xe")).toMatchObject({
      chests_earned: 1,
      rewards: { lords: "99999999999999999999" },
    });
    expect(after.entries.find((entry) => entry.address === "0xc")).toMatchObject({
      chests_earned: 1,
      rewards: { lords: "25" },
    });
  });

  it("counts a ruin's clear as its chest and its stored LORDS in whole units", () => {
    const { read } = facts();
    const [entry] = buildFrontierLeaderboard(read, "1", [clear("Ruin", 0), clear("Ruin", 1)]).entries;
    expect(entry.chests_earned).toBe(2);
    expect(entry.rewards.lords).toBe("400");
  });

  it("counts 3 camps, a rift, a ruin and beasts from stories after site deletion; duplicates and order do not change it", () => {
    const { read } = facts();
    const history = [
      clear("Camp", 0),
      clear("Camp", 1),
      clear("Camp", 2),
      clear("Rift", 3),
      clear("Ruin", 4),
      clear("Beasts", 6),
      story("ExplorationReward", { resource_type: 38, amount: "6000000000000" }, 5),
    ];
    const board = buildFrontierLeaderboard(read, "1", history);
    expect(board.entries[0]).toMatchObject({
      structure_id: "1",
      deepest_depth: 2,
      level: 0,
      order: 3,
      sites_cleared: { total: 6, camps: 3, rifts: 1, ruins: 1, beasts: 1 },
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

  it("shares equal standings without using address or snapshot order as a competitive rank", () => {
    const { read, rows } = facts([0, 0, 0, 0]);
    const history = [clear("Camp", 0, 10)];
    const board = buildFrontierLeaderboard(read, "1", history);
    expect(board.entries.map(({ address, rank }) => ({ address, rank }))).toEqual([
      { address: "0xa", rank: 1 },
      { address: "0xb", rank: 2 },
      { address: "0xc", rank: 2 },
      { address: "0xd", rank: 2 },
    ]);
    rows.Structure.reverse();
    expect(buildFrontierLeaderboard(read, "1", history)).toEqual(board);
    expect(buildFrontierLeaderboard(read, "1", []).entries.map(({ rank }) => rank)).toEqual([1, 1, 1, 1]);
  });
});
