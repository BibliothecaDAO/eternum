import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { Headline } from "./headline-types";
import { readFinalBlitzResult } from "@/ui/features/social/player/finalized-blitz-leaderboard";

/**
 * The end is announced once, from its authority: the season's winner, or a final Blitz result naming its first rank.
 * The clock running out names no one, so it announces nothing; a result still waiting or unavailable does not either.
 */
export function resolveGameEndHeadline(
  store: NativeFactStore,
  gameId: number,
  seasonWinner: bigint | null,
  playerName: (address: bigint) => string,
): Headline | null {
  const winners = seasonWinner ? [seasonWinner] : finalBlitzWinners(store, gameId);
  if (!winners) return null;
  const names = winners.map(playerName);
  return {
    id: `game-end:${gameId}`,
    type: "game-end",
    icon: "game-end",
    title: "THE GAME HAS ENDED",
    description: names.length
      ? `${names.join(" and ")} ${names.length === 1 ? "wins" : "share victory"}!`
      : "No player finished ranked.",
    timestamp: Date.now(),
  };
}

const finalBlitzWinners = (store: NativeFactStore, gameId: number): bigint[] | undefined => {
  const result = readFinalBlitzResult(store, gameId);
  if (result.status !== "final") return undefined;
  return result.standings.filter((standing) => standing.rank === 1).map((standing) => standing.account);
};
