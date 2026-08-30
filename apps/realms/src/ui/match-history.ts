import { Effect } from "effect";

import type { DirectoryGame } from "@/services/herald";
import { LedgerClient, type LedgerReadError } from "@/services/ledger";
import type { AppEffect } from "./hooks";

export interface MatchRow {
  readonly gameId: number;
  readonly gameName: string;
  readonly endAt: number;
  readonly rank: number;
  readonly players: number;
  readonly lordsDelta: bigint;
  readonly mmrDelta: bigint;
  readonly chests: number;
}

const isFinished = (game: DirectoryGame) => game.status === "Ended" || game.status === "Settled";

/**
 * A player's recent finished games, composed from herald's directory (which
 * games exist) and ledger reads (whether they entered, and what came of it).
 */
export const matchHistory = (
  owner: string,
  games: readonly DirectoryGame[],
  limit = 10,
): AppEffect<MatchRow[], LedgerReadError> =>
  Effect.gen(function* () {
    const ledger = yield* LedgerClient;
    const finished = [...games]
      .filter(isFinished)
      .sort((a, b) => b.clock.end_at - a.clock.end_at)
      .slice(0, limit);
    if (finished.length === 0) return [];

    const registrations = yield* ledger.registrations(
      finished.map((game) => game.game_id),
      owner,
    );
    const entered = finished.filter((game) => registrations.get(game.game_id)?.registered);

    const rows = yield* Effect.all(
      entered.map((game) =>
        ledger.playerResult(game.game_id, owner).pipe(
          Effect.map((result): MatchRow | null =>
            result.rank === 0
              ? null
              : {
                  gameId: game.game_id,
                  gameName: game.name,
                  endAt: game.clock.end_at,
                  rank: result.rank,
                  players: game.player_count,
                  lordsDelta: result.payout - (registrations.get(game.game_id)?.paid ?? 0n),
                  mmrDelta: result.mmrAfter - result.mmrBefore,
                  chests: result.chests,
                },
          ),
        ),
      ),
      { concurrency: "unbounded" },
    );
    return rows.filter((row): row is MatchRow => row !== null);
  });
