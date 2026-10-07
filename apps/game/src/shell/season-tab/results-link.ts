import type { GameRef } from "@bibliothecadao/eternum/shard";

import type { DirectoryGame } from "../herald";

/** Where a list opens a result: its page then offers Back to the list and no Continue (spec 08). */
const FROM_LIST = "from=list";

/** A finished game's Results page: /results/<chain>-<game>; from a list it carries the list's mark. */
export const resultsHref = (game: Pick<DirectoryGame, "chainId" | "game_id">, fromList: boolean) =>
  `/results/${game.chainId}-${game.game_id}${fromList ? `?${FROM_LIST}` : ""}`;

/** The game a Results address names, or null for one that names none. */
export const gameOfResults = (id: string | undefined): GameRef | null => {
  const match = /^(0x[0-9a-fA-F]+)-(\d+)$/.exec(id ?? "");
  return match ? { chainId: match[1], gameId: Number(match[2]) } : null;
};

export const isFromList = (search: string) => new URLSearchParams(search).get("from") === "list";
