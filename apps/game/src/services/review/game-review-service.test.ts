// @vitest-environment node

import { createEmptyActivityBreakdown, type HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { tileDataToTile } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGameReviewData } from "./game-review-service";

const PLAYER = "0x62ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const GAME_ID = 5;
const REVIEW_BLOCK = 100;
const TRIAL_ID = "0x1c6b";

const herald = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  fetchLeaderboard: vi.fn(),
  fetchReviewSnapshot: vi.fn(),
  fetchTransactionCount: vi.fn(),
}));

vi.mock("@/runtime/world/herald-http", () => ({
  fetchHeraldGameHistory: herald.fetchHistory,
  fetchHeraldGameLeaderboard: herald.fetchLeaderboard,
  fetchHeraldGameReviewSnapshot: herald.fetchReviewSnapshot,
  fetchHeraldTransactionCount: herald.fetchTransactionCount,
}));

vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: (worldId: string) =>
    worldId === "blitz"
      ? {
          id: "blitz",
          chain: "appchain",
          heraldBaseUrl: "https://herald.blitz.test",
          rpcUrl: "https://rpc.blitz.test",
          namespace: "s2",
          worldAddress: "0x123",
          contractsBySelector: {},
        }
      : null,
}));

vi.mock("@/runtime/world/game-registry", () => ({
  resolveWorldIdForGame: vi.fn(async () => "blitz"),
  resolveGameId: vi.fn(async () => GAME_ID),
}));

vi.mock("@bibliothecadao/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/types")>()),
  tileDataToTile: vi.fn(),
}));

const model = (name: string, values: Array<Record<string, unknown>>) => ({
  model: name,
  rows: values.map((value, index) => ({ key: `0x${index + 1}`, value })),
});

const reviewSnapshot = (): HeraldGameSnapshot => ({
  confirmed_block: REVIEW_BLOCK,
  game_id: String(GAME_ID),
  models: [
    model("GameRegistry", [{ start_main_at: 10, end_at: 90, dev_mode_on: false, final_trial_id: TRIAL_ID }]),
    model("WorldConfig", [{ blitz_registration_config: { registration_count: 4 } }]),
    model("BlitzSettlement", [{ player: PLAYER }]),
    model("PlayerRegisteredPoints", [{ address: PLAYER, registered_points: "0x77359400" }]),
    model("PlayerRank", [{ player: PLAYER, rank: 1, chests: 2 }]),
    model("RankPrize", [{ rank: 1, total_players_same_rank_count: 1, grant_elite_nft: false }]),
    model("PlayersRankTrial", [{ nonce: TRIAL_ID, total_player_count_committed: 4 }]),
    model("AddressName", []),
    model("Structure", []),
    model("TileOpt", []),
  ],
});

describe("game review Herald read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    herald.fetchReviewSnapshot.mockResolvedValue(reviewSnapshot());
    const activityBreakdown = createEmptyActivityBreakdown();
    activityBreakdown.exploration = { count: 166, points: 830 };
    herald.fetchLeaderboard.mockResolvedValue({
      game_id: String(GAME_ID),
      entries: [{ address: PLAYER, rank: 1, totalPoints: 830, activityBreakdown }],
    });
    herald.fetchHistory.mockResolvedValue({
      complete_through_block: REVIEW_BLOCK,
      items: [],
      limit: 500,
      offset: 0,
      total: 0,
    });
    herald.fetchTransactionCount.mockResolvedValue({ count: 42, game_id: String(GAME_ID) });
  });

  it("builds the exact L3 result and transaction stats without a SQL reader", async () => {
    const review = await fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER });

    expect(review.stats.totalTransactions).toBe(42);
    expect(review.stats.totalTilesExplored).toBe(166);
    expect(review.rewards?.isRanked).toBe(true);
    expect(review.rewards?.chests).toBe(2);
    expect(herald.fetchReviewSnapshot).toHaveBeenCalledOnce();
  });

  it("preserves both layers at one coordinate and fingerprints layer identity", async () => {
    const snapshot = reviewSnapshot();
    snapshot.models.find(({ model }) => model === "TileOpt")!.rows = [
      { key: "0x11", value: { data: "1" } },
      { key: "0x12", value: { data: "2" } },
    ];
    vi.mocked(tileDataToTile).mockImplementation((data) => ({
      alt: data === "2",
      col: 10,
      row: 20,
      biome: 3,
      occupier_id: 9,
      occupier_type: 35,
      occupier_is_structure: false,
      reward_extracted: false,
    }));
    herald.fetchReviewSnapshot.mockResolvedValue(snapshot);
    const first = await fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER });
    expect(first.mapSnapshot).toMatchObject({
      available: true,
      totalTiles: 2,
      tiles: [
        { alt: false, col: 10, row: 20 },
        { alt: true, col: 10, row: 20 },
      ],
    });
    snapshot.models.find(({ model }) => model === "TileOpt")!.rows.reverse();
    const reordered = await fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER });
    expect(reordered.mapSnapshot).toEqual(first.mapSnapshot);
    vi.mocked(tileDataToTile).mockImplementation(() => ({
      alt: false,
      col: 10,
      row: 20,
      biome: 3,
      occupier_id: 9,
      occupier_type: 35,
      occupier_is_structure: false,
      reward_extracted: false,
    }));
    const collapsed = await fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER });
    expect(collapsed.mapSnapshot).not.toEqual(first.mapSnapshot);
  });

  it("refuses a review until history covers the frozen snapshot block", async () => {
    herald.fetchHistory.mockResolvedValue({
      complete_through_block: REVIEW_BLOCK - 1,
      items: [],
      limit: 500,
      offset: 0,
      total: 0,
    });
    await expect(
      fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER }),
    ).rejects.toThrow(/complete through block 99/);
  });
});
