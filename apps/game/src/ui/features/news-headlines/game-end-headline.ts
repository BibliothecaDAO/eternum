import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { Headline, HeadlinePart } from "./headline-types";
import { readFinalBlitzResult } from "@/ui/features/social/player/finalized-blitz-leaderboard";

/**
 * The end is announced once, from its authority: the season's winner, or a final Blitz result naming its first rank.
 * The clock running out names no one, so it announces nothing; a result still waiting or unavailable does not either.
 */
export function resolveGameEndHeadline(
  store: NativeFactStore,
  gameId: number,
  seasonWinner: bigint | null,
): Headline | null {
  const winners = seasonWinner ? [seasonWinner] : finalBlitzWinners(store, gameId);
  if (!winners) return null;
  return {
    id: `game-end:${gameId}`,
    type: "game-end",
    icon: "game-end",
    title: "The game has ended",
    description: winners.length
      ? [
          ...winners.flatMap((player, index): HeadlinePart[] => (index === 0 ? [{ player }] : [" and ", { player }])),
          winners.length === 1 ? " wins!" : " share victory!",
        ]
      : ["No player finished ranked."],
    timestamp: Date.now(),
  };
}

const finalBlitzWinners = (store: NativeFactStore, gameId: number): bigint[] | undefined => {
  const result = readFinalBlitzResult(store, gameId);
  if (result.status !== "final") return undefined;
  return result.standings.filter((standing) => standing.rank === 1).map((standing) => standing.account);
};
