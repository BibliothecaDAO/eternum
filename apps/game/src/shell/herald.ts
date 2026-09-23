import { fetchHeraldGameDirectory, fetchHeraldGameLeaderboard, type GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";

import { fetchDirectory, type DirectoryShard } from "@/runtime/world/directory";
import { listPastedShards, openPastedShards, requireOpenShard } from "@/runtime/world/shards";

/** A directory entry with the shard it came from, so the shell can address the game as (chain id, game id). */
export interface DirectoryGame extends HeraldGameDirectoryEntry {
  chainId: string;
}

/** A shard the shell shows: one our directory lists, or one the player pasted. */
interface ShardListing {
  url: string;
  chainId: string;
  status: "active" | "draining" | "pasted";
  available: boolean;
}

interface ShardDirectory {
  games: DirectoryGame[];
  shards: ShardListing[];
  /** Shards known but not readable, by URL and reason: the directory's own, and pasted ones that would not open. */
  failures: { url: string; error: Error }[];
}

export const DIRECTORY_QUERY_KEY = ["shell", "directory"] as const;

/**
 * Our directory from the Worker (its games, its caching, its per-shard partial failures), plus the directories of the
 * shards the player pasted, read from those shards themselves since our directory does not list them. No listed
 * shard's Herald is contacted here: a game's shard opens only when the game is entered.
 */
export const fetchDirectories = async (player: string | null): Promise<ShardDirectory> => {
  const [listing, pastedFailures] = await Promise.all([fetchDirectory(player), openPastedShards()]);
  const listed = listing.filter(
    (shard): shard is DirectoryShard & { status: "active" | "draining" } => shard.status !== "retired",
  );
  const pasted = listPastedShards().filter((shard) => !listed.some((entry) => entry.url === shard.url));
  const pastedDirectories = await Promise.all(
    pasted.map((shard) =>
      fetchHeraldGameDirectory(shard, player ?? undefined).then((directory) => ({ shard, directory })),
    ),
  );
  return {
    games: [
      ...listed.flatMap((shard) => (shard.games ?? []).map((game) => ({ ...game, chainId: shard.chainId }))),
      ...pastedDirectories.flatMap(({ shard, directory }) =>
        directory.games.map((game) => ({ ...game, chainId: shard.chainId })),
      ),
    ],
    shards: [
      ...listed.map((shard) => ({
        url: shard.url,
        chainId: shard.chainId,
        status: shard.status,
        available: shard.games !== null,
      })),
      ...pasted.map((shard) => ({
        url: shard.url,
        chainId: shard.chainId,
        status: "pasted" as const,
        available: true,
      })),
    ],
    failures: [
      ...listed
        .filter((shard) => shard.games === null)
        .map((shard) => ({ url: shard.url, error: new Error("unavailable right now") })),
      ...pastedFailures,
    ],
  };
};

/** Every listed and pasted shard's games; a pasted shard also says whether the gameplay account is registered. */
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
