import { useAccountStore } from "@/hooks/store/use-account-store";
import { getActiveGame } from "@/runtime/world";
import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldDayRanks, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";
import { useRacesAspects } from "../aspect/races-aspects";

/** A day's closing ranks never change once Herald has them. */
const CLOSED = Number.POSITIVE_INFINITY;

/**
 * The player's season rank at the end of an ended day against the day before it, from Herald's closing ranks of each
 * day: undefined while either is being read; null where there is none to tell (the season's first day, which follows
 * none, a player on neither day's ranks, ranks Herald could not give).
 */
export const useClosingRankChange = (endedDay: number | undefined): { from: number; to: number } | null | undefined => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  // Only a game without race rules ranks players by the sites they cleared; a Season 1 game races Aspects, and Herald
  // closes no player ranks for it, so nothing asks.
  const races = useRacesAspects();
  const ranked = races === false;
  // Days are one-based on the card and zero-based in Herald.
  const to = useDayRank(endedDay === undefined || !ranked ? undefined : endedDay - 1, player);
  const from = useDayRank(endedDay === undefined || endedDay < 2 || !ranked ? undefined : endedDay - 2, player);
  if (races) return null;
  if (races === undefined || from === undefined || to === undefined) return undefined;
  return from === null || to === null ? null : { from, to };
};

/** The player's closing rank on a day: undefined while it is read, null for no such day or no rank on it. */
const useDayRank = (dayIndex: number | undefined, player: string | null): number | null | undefined => {
  const chainId = getActiveGame()?.chainId;
  const gameId = configManager.getActiveGameId();
  const ranks = useQuery({
    queryKey: ["frontierDayRanks", chainId, gameId, dayIndex],
    queryFn: () => fetchHeraldDayRanks(requireShard(), gameId, dayIndex!),
    enabled: dayIndex !== undefined,
    staleTime: CLOSED,
  });
  if (dayIndex === undefined || ranks.isError) return null;
  if (!ranks.data) return undefined;
  const own = normalizeLeaderboardAddress(player);
  return ranks.data.entries.find((entry) => normalizeLeaderboardAddress(entry.address) === own)?.rank ?? null;
};
