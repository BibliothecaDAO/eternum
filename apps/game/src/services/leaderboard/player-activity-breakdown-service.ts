import { fetchHeraldGameLeaderboard } from "@bibliothecadao/eternum/game-client";
import type { Shard } from "@bibliothecadao/eternum/game-client";
export type { PlayerActivityBreakdown, PlayerLeaderboardActivityEntry } from "@bibliothecadao/eternum/game-sync";

export const fetchLeaderboardActivityBreakdowns = async (world: Shard, gameId: number) =>
  (await fetchHeraldGameLeaderboard(world, gameId)).entries;
