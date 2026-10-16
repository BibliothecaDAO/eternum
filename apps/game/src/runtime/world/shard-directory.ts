import { fetchHeraldGameDirectory, type GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldGameDirectory, HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
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

const readShardDirectory = (chainId: string, player: string | null, maxAgeMs: number) =>
  appQueryClient.fetchQuery({ ...shardDirectoryQuery(chainId, player), staleTime: maxAgeMs });

/**
 * A game's row in its shard's directory; a game its shard does not list is an error. `maxAgeMs` is how old an answer
 * already read may be (the default asks the shard afresh); readers asking at once share one request. An earlier answer
 * vouches only for the games it lists: a game it does not list may be new, so the shard is asked again.
 */
export const readGameEntry = async (
  game: GameRef,
  player: string | null,
  maxAgeMs = 0,
): Promise<HeraldGameDirectoryEntry> => {
  const entry =
    findGame(await readShardDirectory(game.chainId, player, maxAgeMs), game) ??
    (maxAgeMs > 0 ? findGame(await readShardDirectory(game.chainId, player, 0), game) : undefined);
  if (!entry) throw new Error(`Shard ${game.chainId} lists no game ${game.gameId}`);
  return entry;
};

const findGame = (directory: HeraldGameDirectory, game: GameRef) =>
  directory.games.find((candidate) => candidate.game_id === game.gameId);
