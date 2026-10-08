import { useAccountStore } from "@/hooks/store/use-account-store";
import { getActiveGame } from "@/runtime/world";
import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldDayRanks, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";

/** A day's closing ranks never change once Herald has them. */
const CLOSED = Number.POSITIVE_INFINITY;

/**
 * The player's season rank at the end of an ended day against the day before it, from Herald's closing ranks of each
 * day; undefined while either is unknown, and on the season's first day, which follows none.
 */
export const useClosingRankChange = (endedDay: number | undefined): { from: number; to: number } | undefined => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  // Days are one-based on the card and zero-based in Herald.
  const to = useDayRank(endedDay === undefined ? undefined : endedDay - 1, player);
  const from = useDayRank(endedDay === undefined || endedDay < 2 ? undefined : endedDay - 2, player);
  return from === undefined || to === undefined ? undefined : { from, to };
};

const useDayRank = (dayIndex: number | undefined, player: string | null): number | undefined => {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  const ranks = useQuery({
    queryKey: ["frontierDayRanks", shard.url, gameId, dayIndex],
    queryFn: () => fetchHeraldDayRanks(shard, gameId, dayIndex!),
    enabled: dayIndex !== undefined,
    staleTime: CLOSED,
  });
  const own = normalizeLeaderboardAddress(player);
  return ranks.data?.entries.find((entry) => normalizeLeaderboardAddress(entry.address) === own)?.rank;
};
