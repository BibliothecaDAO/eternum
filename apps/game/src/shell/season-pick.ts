import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import type { HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { isSeasonGame } from "@bibliothecadao/types";

import { isGameOver } from "@/runtime/world/directory";

import type { DirectoryGame } from "./herald";

export const isRehearsal = (game: Pick<DirectoryGame, "name">): boolean => !isSeasonGame(game.name);

export const seasonRealm = (season: Pick<DirectoryGame, "player_state">): HeraldPlayerStructure | null =>
  season.player_state?.structures.find((structure) => isRealmCategory(structure.category)) ?? null;

export const hasSeasonRealm = (season: Pick<DirectoryGame, "player_state">): boolean => seasonRealm(season) !== null;

const chooseFrontier =
  (kept: (game: DirectoryGame) => boolean) =>
  (games: readonly DirectoryGame[], signedIn: boolean): DirectoryGame | undefined => {
    const open = games
      .filter((game) => game.mode === "frontier" && kept(game) && !isGameOver(game))
      .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at || a.game_id - b.game_id);
    const live = open.filter((game) => game.status === "Live");
    const available = live.length > 0 ? live : open;
    return (signedIn ? available.find(hasSeasonRealm) : undefined) ?? available[0];
  };

export const chooseSeason = chooseFrontier((game) => !isRehearsal(game));

export const chooseRehearsal = chooseFrontier(isRehearsal);
