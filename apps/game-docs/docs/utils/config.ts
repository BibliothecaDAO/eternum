import { getConfigFromNetwork, type GameType } from "@config";
import { DOCS_CHAIN } from "../../env";

/**
 * A mode's balance as the game reads it, from its generated config document. Every caller names its mode: a page is
 * Blitz's or Eternum's, and a shared component takes its page's mode, so a Blitz page never reads Eternum's numbers.
 * A missing mode fails the build at prerender instead of falling back to one.
 */
export const ETERNUM_CONFIG = (gameType: GameType) => {
  if (!gameType) throw new Error("ETERNUM_CONFIG needs the page's game mode");
  return getConfigFromNetwork(DOCS_CHAIN, gameType);
};
