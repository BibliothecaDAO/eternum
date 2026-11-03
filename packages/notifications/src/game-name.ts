import { GAME_MODE_NAMES, type GameModeName } from "../../types/src/words/modes";

/** What a push needs to name its game: the directory's mode. */
export interface PushGame {
  mode: GameModeName | null;
}

/**
 * The game a push names before its line: its mode as the app labels it ("Frontier", "Blitz"). Never the registry's
 * name, which is an id ("frontier-1793451600"), nor a season's number; a game the directory no longer lists is "Realms".
 */
export const pushGameName = (game: PushGame | undefined): string =>
  game?.mode ? GAME_MODE_NAMES[game.mode] : "Realms";
