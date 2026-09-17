import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { Headline } from "./headline-types";

/** Clock expiry announces the end; only finalized ranks or a season result name winners. */
export function resolveGameEndHeadline(
  store: NativeFactStore,
  gameId: number,
  nowSeconds: number,
  seasonWinner: bigint | null,
  playerName: (address: bigint) => string,
): Headline | null {
  const game = store.get("GameRegistry", { game_id: gameId });
  const endedByClock = game && game.end_at > 0n && BigInt(nowSeconds) >= game.end_at;
  if (!seasonWinner && !endedByClock) return null;

  const winners = seasonWinner
    ? [seasonWinner]
    : game?.final_trial_id
      ? [...store.inGame("PlayerRank", gameId)]
          .filter((row) => row.rank === 1)
          .map((row) => row.player)
          .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      : [];
  const names = winners.map(playerName);
  return {
    id: `game-end:${gameId}:${winners.length ? "result" : "clock"}`,
    type: "game-end",
    icon: "game-end",
    title: "THE GAME HAS ENDED",
    description: names.length
      ? `${names.join(" and ")} ${names.length === 1 ? "wins" : "share victory"}!`
      : "The final result is awaiting settlement.",
    timestamp: Date.now(),
  };
}
