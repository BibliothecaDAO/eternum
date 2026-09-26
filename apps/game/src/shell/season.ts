import { isGameOver } from "@/runtime/world/directory";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";

import type { DirectoryGame } from "./herald";

/** The player's realm in the season: the structure the directory lists for them, if they have founded one. */
export const seasonRealm = (season: DirectoryGame) =>
  season.player_state?.structures.find((structure) => isRealmCategory(structure.category));

/**
 * The Frontier season a screen shows: the player's own, where their realm stands, else a live one. Among several, the
 * latest to start, then the lowest game id, so the choice never rests on the directory's order.
 */
export const chooseSeason = (games: readonly DirectoryGame[], signedIn: boolean): DirectoryGame | undefined => {
  const seasons = games
    .filter((game) => game.mode === "frontier" && !isGameOver(game))
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at || a.game_id - b.game_id);
  return (signedIn ? seasons.find((game) => seasonRealm(game)) : undefined) ?? seasons[0];
};
