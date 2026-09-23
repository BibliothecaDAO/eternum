import {
  fetchHeraldGameDirectory,
  fetchHeraldGameLeaderboard,
  type GameRef,
  type Shard,
} from "@bibliothecadao/eternum/shard";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";

import { listOpenShards, openKnownShards, requireOpenShard } from "@/runtime/world/shards";

/** A directory entry with the shard it came from, so the shell can address the game as (chain id, game id). */
export interface DirectoryGame extends HeraldGameDirectoryEntry {
  chainId: string;
}

interface ShardDirectory {
  games: DirectoryGame[];
  shards: Shard[];
  /** Shards this client knows but could not open, by URL and reason; never hidden behind an empty list. */
  failures: { url: string; error: Error }[];
  confirmedBlocks: Record<string, number>;
}

export const DIRECTORY_QUERY_KEY = ["shell", "directory"] as const;

const fetchDirectories = async (player: string | null): Promise<ShardDirectory> => {
  const failures = await openKnownShards();
  const shards = listOpenShards();
  const directories = await Promise.all(
    shards.map((shard) =>
      fetchHeraldGameDirectory(shard, player ?? undefined).then((directory) => ({ shard, directory })),
    ),
  );
  return {
    shards,
    failures,
    games: directories.flatMap(({ shard, directory }) =>
      directory.games.map((game) => ({ ...game, chainId: shard.chainId })),
    ),
    confirmedBlocks: Object.fromEntries(
      directories.map(({ shard, directory }) => [shard.chainId, directory.confirmed_block]),
    ),
  };
};

/** Every open shard's directory; with a gameplay account, each game also says whether that player is registered. */
export const useDirectory = (player: string | null = null) =>
  useQuery({
    queryKey: [...DIRECTORY_QUERY_KEY, player],
    queryFn: () => fetchDirectories(player),
    refetchInterval: 15_000,
    retry: 1,
  });

/** Live points while a game runs; the recorded final standings once its result is complete. */
export const useLeaderboard = (game: GameRef | null) =>
  useQuery({
    queryKey: ["shell", "leaderboard", game?.chainId, game?.gameId],
    queryFn: async () =>
      fetchHeraldGameLeaderboard(await requireOpenShard((game as GameRef).chainId), (game as GameRef).gameId),
    enabled: game !== null,
    refetchInterval: 30_000,
    retry: 1,
  });

/** Blitz membership is the roster fact; open-entry modes count anyone registered. */
export const isMember = (game: DirectoryGame): boolean =>
  game.mode === "blitz" ? game.player_state?.roster_member === true : game.player_state?.registered === true;

const OPEN_STATUSES = new Set(["Created", "Registration"]);

/** The soonest game still taking players. */
export const nextOpenGame = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  games
    .filter((game) => OPEN_STATUSES.has(game.status))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];

export const isGameOver = (game: DirectoryGame): boolean => game.status === "Ended" || game.status === "Settled";

/** Games with a recorded result, newest first. */
export const finishedGames = (games: readonly DirectoryGame[]): DirectoryGame[] =>
  games.filter((game) => game.status === "Settled").toSorted((a, b) => b.clock.end_at - a.clock.end_at);

export const sameGame = (left: GameRef, right: GameRef): boolean =>
  left.chainId === right.chainId && left.gameId === right.gameId;
