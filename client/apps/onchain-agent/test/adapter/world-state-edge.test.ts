import { describe, expect, it, vi } from "vitest";
import { buildWorldState } from "../../src/adapter/world-state";

describe("buildWorldState edge cases", () => {
  it("handles missing structures/armies/market arrays without throwing", async () => {
    const client = {
      view: {
        player: vi.fn().mockResolvedValue({
          address: "0xabc",
          name: "EdgePlayer",
          structures: [],
          armies: [],
          points: 0,
          rank: 0,
          totalResources: undefined,
        }),
        market: vi.fn().mockResolvedValue({}),
        leaderboard: vi.fn().mockResolvedValue({ entries: undefined, totalPlayers: undefined }),
      },
      sql: {
        fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
        fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const state = await buildWorldState(client, "0xabc");

    expect(state.entities).toEqual([]);
    expect(Array.from(state.resources.entries())).toEqual([]);
    expect(state.market.recentSwapCount).toBe(0);
    expect(state.market.openOrderCount).toBe(0);
    expect(state.leaderboard.topPlayers).toEqual([]);
    expect(state.leaderboard.totalPlayers).toBe(0);
  });
});
