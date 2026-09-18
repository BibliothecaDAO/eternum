import { Effect } from "effect";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { HeraldClient, type DirectoryGame } from "@/services/herald";
import { BoundaryDecodeError } from "@/services/platform/errors";

export interface MatchRow {
  readonly gameId: number;
  readonly gameName: string;
  readonly endAt: number;
  readonly rank: number;
  readonly players: number;
  readonly points: bigint;
}

/** Immutable finalized results, with identity resolved through each game's frozen roster. */
export const matchHistory = (owner: string, games: readonly DirectoryGame[], limit = 10) =>
  Effect.gen(function* () {
    if (limit <= 0) return [];
    const herald = yield* HeraldClient;
    const finished = [...games]
      .filter((game) => game.mode === "blitz" && game.status === "Settled")
      .sort((a, b) => b.clock.end_at - a.clock.end_at)
      .slice(0, limit);
    const rows: MatchRow[] = [];
    for (const game of finished) {
      const facts = yield* herald.gameFacts(game.game_id);
      const row = yield* Effect.try({
        try: () => playerMatch(facts, game, owner),
        catch: (cause) => new BoundaryDecodeError({ boundary: `herald:game:${game.game_id}`, cause }),
      });
      if (row) rows.push(row);
    }
    return rows;
  });

function playerMatch(facts: NativeFactStore, game: DirectoryGame, owner: string): MatchRow | null {
  const roster = facts.require("BlitzRoster", { game_id: game.game_id });
  const player = roster.players.find((entry) => entry.owner === BigInt(owner));
  if (!player) return null;
  const result = facts.get("BlitzResult", { game_id: game.game_id });
  if (!result?.complete) return null;
  const entry = result.players.find((entry) => entry.player === player.account);
  if (!entry) throw new Error("Final result omits a roster player");
  return {
    gameId: game.game_id,
    gameName: game.name,
    endAt: game.clock.end_at,
    rank: entry.rank,
    players: result.players.length,
    points: entry.points,
  };
}
