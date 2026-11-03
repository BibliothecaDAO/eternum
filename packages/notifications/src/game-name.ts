import { GAME_MODE_NAMES, type GameModeName } from "../../types/src/words/modes";

/** What a push needs to name its game: the directory's mode and, for a season, its number. */
export interface PushGame {
  mode: GameModeName | null;
  season_number?: number | null;
}

/** A season's name as every surface writes it: "Season 0" for Devcon. */
export const seasonName = (number: number): string => `Season ${number}`;

/**
 * The game a push names before its line: a season by its name ("Season 0"), any other game by its mode ("Blitz").
 * Never the registry's name, which is an id ("frontier-1793451600"); a game the directory no longer lists is "Realms".
 */
export const pushGameName = (game: PushGame | undefined): string => {
  if (!game?.mode) return "Realms";
  if (game.mode === "frontier" && game.season_number != null) return seasonName(game.season_number);
  return GAME_MODE_NAMES[game.mode];
};
