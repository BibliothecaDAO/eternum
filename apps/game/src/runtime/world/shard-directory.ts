import { fetchHeraldGameDirectory, type GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { queryOptions } from "@tanstack/react-query";

import { appQueryClient } from "../query-client";
import { requireOpenShard } from "./shards";

/**
 * A shard's game directory as its Herald answers it; with a player, each game carries that player's standing. One cache
 * entry per shard and player, so every screen that reads a game's directory row reads the same answer.
 */
export const shardDirectoryQuery = (chainId: string, player: string | null) =>
  queryOptions({
    queryKey: ["shard-directory", chainId, player],
    queryFn: async () => fetchHeraldGameDirectory(await requireOpenShard(chainId), player ?? undefined),
  });

export const readShardDirectory = (chainId: string, player: string | null) =>
  appQueryClient.fetchQuery(shardDirectoryQuery(chainId, player));

/** A game's row in its shard's directory; a game its shard does not list is an error. */
export const readGameEntry = async (game: GameRef, player: string | null): Promise<HeraldGameDirectoryEntry> => {
  const directory = await readShardDirectory(game.chainId, player);
  const entry = directory.games.find((candidate) => candidate.game_id === game.gameId);
  if (!entry) throw new Error(`Shard ${game.chainId} lists no game ${game.gameId}`);
  return entry;
};
