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
 * day: undefined while either is being read; null where there is none to tell (the season's first day, which follows
 * none, a player on neither day's ranks, ranks Herald could not give).
 */
export const useClosingRankChange = (endedDay: number | undefined): { from: number; to: number } | null | undefined => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  // Days are one-based on the card and zero-based in Herald.
  const to = useDayRank(endedDay === undefined ? undefined : endedDay - 1, player);
  const from = useDayRank(endedDay === undefined || endedDay < 2 ? undefined : endedDay - 2, player);
  if (from === undefined || to === undefined) return undefined;
  return from === null || to === null ? null : { from, to };
};

/** The player's closing rank on a day: undefined while it is read, null for no such day or no rank on it. */
const useDayRank = (dayIndex: number | undefined, player: string | null): number | null | undefined => {
  const chainId = getActiveGame()?.chainId;
  const gameId = configManager.getActiveGameId();
  const ranks = useQuery({
    queryKey: ["frontierDayRanks", chainId, gameId, dayIndex],
    queryFn: () => fetchHeraldDayRanks(requireShard(chainId), gameId, dayIndex!),
    enabled: dayIndex !== undefined,
    staleTime: CLOSED,
  });
  if (dayIndex === undefined || ranks.isError) return null;
  if (!ranks.data) return undefined;
  const own = normalizeLeaderboardAddress(player);
  return ranks.data.entries.find((entry) => normalizeLeaderboardAddress(entry.address) === own)?.rank ?? null;
};
