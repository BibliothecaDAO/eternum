import { fetchHeraldLeaderboard } from "@bibliothecadao/eternum/game-client";
import type { Shard } from "@bibliothecadao/eternum/game-client";
export type { PlayerActivityBreakdown, PlayerLeaderboardActivityEntry } from "@bibliothecadao/eternum/game-sync";

/** The points breakdown by activity; the players panel that reads it belongs to the points modes' HUD only. */
export const fetchLeaderboardActivityBreakdowns = async (world: Shard, gameId: number) => {
  const board = await fetchHeraldLeaderboard(world, gameId);
  if (board.mode === "frontier") throw new Error(`Game ${gameId} ranks a Frontier season, which has no points`);
  return board.entries;
};
