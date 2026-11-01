import type { GameRef } from "@bibliothecadao/eternum/shard";

import { type DirectoryGame, useDirectory, useRealmsPlayer, useRecentResults } from "../herald";
import { ARCHIVED_SEASONS } from "./archive/archive";

/**
 * A finished game's record: from the directory (ended), the player's history (settled), every player's recent
 * history, which holds a game the reader had no seat in (a shared Results; qa-app-2 P3-13), or the archived seasons.
 */
export const useFinishedGame = (ref: GameRef | null) => {
  const { data: player } = useRealmsPlayer();
  const directory = useDirectory();
  const history = useRecentResults(50, player);
  const everyone = useRecentResults(50);
  const matches = (game: DirectoryGame) => ref !== null && game.chainId === ref.chainId && game.game_id === ref.gameId;
  return (
    directory.data?.games.find(matches) ??
    history.data?.games.find(matches) ??
    everyone.data?.games.find(matches) ??
    ARCHIVED_SEASONS.find(matches)
  );
};
