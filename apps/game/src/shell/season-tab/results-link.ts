import type { GameRef } from "@bibliothecadao/eternum/shard";

import type { DirectoryGame } from "../herald";

/**
 * A finished game's Results page: /results/<chain>-<game>. A list opens it with `openedFrom`, and the page then offers
 * Back to the list and no Continue (spec 08).
 */
export const resultsHref = (game: Pick<DirectoryGame, "chainId" | "game_id">) =>
  `/results/${game.chainId}-${game.game_id}`;

/** The game a Results address names, or null for one that names none. */
export const gameOfResults = (id: string | undefined): GameRef | null => {
  const match = /^(0x[0-9a-fA-F]+)-(\d+)$/.exec(id ?? "");
  return match ? { chainId: match[1], gameId: Number(match[2]) } : null;
};
