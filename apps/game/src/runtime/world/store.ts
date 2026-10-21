import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { GameProfile } from "./types";

/** One spelling of a game's name for keys and caches: its shard's chain id and its id there. */
export const gameKey = (game: GameRef): string => `${game.chainId}:${game.gameId}`;

/**
 * The game this page plays, held by the page alone: every tab plays its own game, so a Frontier opened in another tab
 * never changes which game this one's Results, chat or seats belong to. A reload enters the game again from its address.
 */
let activeGame: GameProfile | null = null;

export const setActiveGame = (game: GameProfile) => {
  activeGame = game;
};

export const getActiveGame = (): GameProfile | null => activeGame;

/** The game this client plays, asked for from inside it: there, none is a fault. */
export const requireActiveGame = (): GameProfile => {
  if (!activeGame) throw new Error("No active game");
  return activeGame;
};
