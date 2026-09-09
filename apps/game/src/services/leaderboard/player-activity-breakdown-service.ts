import { fetchHeraldGameLeaderboard } from "@/runtime/world/herald-http";
import type { WorldDeployment } from "@/runtime/world/world-directory";
export type { PlayerActivityBreakdown, PlayerLeaderboardActivityEntry } from "@bibliothecadao/eternum/game-sync";

export const fetchLeaderboardActivityBreakdowns = async (world: WorldDeployment, gameId: number) =>
  (await fetchHeraldGameLeaderboard(world, gameId)).entries;
