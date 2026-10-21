import type { GameRef } from "@bibliothecadao/eternum/shard";

/**
 * A finished game's Results page, named by the game's own identity: /results/<chain>-<game>. Every way to a game's
 * results (the finished pill, its doorway, Play's card, a history row, Share) goes through here. A list opens it with
 * `openedFrom`, and the page then offers Back to the list and no Continue (spec 08).
 */
export const resultsHref = (game: GameRef) => `/results/${game.chainId}-${game.gameId}`;

/** The game a Results address names, or null for one that names none. */
export const gameOfResults = (id: string | undefined): GameRef | null => {
  const match = /^(0x[0-9a-fA-F]+)-(\d+)$/.exec(id ?? "");
  return match ? { chainId: match[1], gameId: Number(match[2]) } : null;
};
