import type { GameRef } from "@bibliothecadao/eternum/shard";

import { type DirectoryGame, useDirectory, useRealmsPlayer, useRecentResults, useSettledGames } from "../herald";
import { ARCHIVED_SEASONS } from "./archive/archive";

export const useFinishedGame = (ref: GameRef | null): DirectoryGame | null | undefined => {
  const { data: player } = useRealmsPlayer();
  const directory = useDirectory();
  const history = useRecentResults(50, player);
  const everyone = useRecentResults(50);
  const settled = useSettledGames();
  const matches = (game: DirectoryGame) => ref !== null && game.chainId === ref.chainId && game.game_id === ref.gameId;
  const found =
    directory.data?.games.find(matches) ??
    history.data?.games.find(matches) ??
    everyone.data?.games.find(matches) ??
    settled.data?.find(matches) ??
    ARCHIVED_SEASONS.find(matches);
  if (found) return found;
  return [directory, history, everyone, settled].some((list) => list.isPending) ? undefined : null;
};
