// @vitest-environment node

import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PLAYER = "0x62ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const GAME_ID = 5;
const REVIEW_BLOCK = 100;
const TRIAL_ID = "0x1c6b";

const herald = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  fetchReviewSnapshot: vi.fn(),
  fetchTransactionCount: vi.fn(),
}));

vi.mock("@/runtime/world/herald-http", () => ({
  fetchHeraldGameHistory: herald.fetchHistory,
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
    model("GameRegistry", [
      { start_main_at: 10, end_at: 90, registration_grace_seconds: 0, dev_mode_on: false, final_trial_id: TRIAL_ID },
    ]),
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
    const { fetchGameReviewData } = await import("./game-review-service");

    const review = await fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER });

    expect(review.stats.totalTransactions).toBe(42);
    expect(review.rewards?.isRanked).toBe(true);
    expect(review.rewards?.chests).toBe(2);
    expect(herald.fetchReviewSnapshot).toHaveBeenCalledOnce();
  });

  it("refuses a review until history covers the frozen snapshot block", async () => {
    herald.fetchHistory.mockResolvedValue({
      complete_through_block: REVIEW_BLOCK - 1,
      items: [],
      limit: 500,
      offset: 0,
      total: 0,
    });
    const { fetchGameReviewData } = await import("./game-review-service");

    await expect(
      fetchGameReviewData({ worldName: "adam-14", chain: "appchain", playerAddress: PLAYER }),
    ).rejects.toThrow(/complete through block 99/);
  });
});
