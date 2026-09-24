import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";

export type DirectoryShardStatus = "active" | "draining" | "retired";

/** One shard as our directory lists it; `games` is null when the Worker could not read that shard. */
export interface DirectoryShard {
  url: string;
  chainId: string;
  status: DirectoryShardStatus;
  games: HeraldGameDirectoryEntry[] | null;
  error?: "unavailable";
}

/**
 * Our directory: the shards we list and every game on them, served by the identity Worker under the app's own /api
 * with its caching and per-shard partial failures. The client never fans in shard Heralds itself; a shard the Worker
 * could not read stays listed by name with no games. With a player, each game also carries that player's state on
 * its shard (registered, on the roster), which the Worker reads from the shard for that request.
 */
export const fetchDirectory = async (player: string | null = null): Promise<DirectoryShard[]> => {
  const query = player ? `?player=${encodeURIComponent(player)}` : "";
  const response = await fetch(`/api/directory${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Directory answered ${response.status}`);
  const { shards } = (await response.json()) as { shards: DirectoryShard[] };
  return shards;
};

/** Blitz membership is the roster fact; open-entry modes count anyone registered. Needs the entry read for a player. */
export const isMember = (game: HeraldGameDirectoryEntry): boolean =>
  game.mode === "blitz" ? game.player_state?.roster_member === true : game.player_state?.registered === true;

/** Over at Herald's chain clock: ended, or settled with its recorded result. */
export const isGameOver = (game: HeraldGameDirectoryEntry): boolean =>
  game.status === "Ended" || game.status === "Settled";

/** The shards the directory still serves: retired ones are history. */
export const listedShards = (shards: readonly DirectoryShard[]): DirectoryShard[] =>
  shards.filter((shard) => shard.status !== "retired");

/** A finished game in our history, with the shard it lives on. */
interface HistoryGame extends HeraldGameDirectoryEntry {
  chainId: string;
  shardUrl: string;
}

interface DirectoryHistoryPage {
  games: HistoryGame[];
  /** Opaque cursor for the next page; null on the last one. */
  next: string | null;
  /** Listed shards that could not answer for this page, by URL. */
  failures: { url: string; error: "unavailable" }[];
}

/**
 * Our history: every settled game on the shards we list, newest first, a page at a time. With a player, only the
 * games that player took part in.
 */
export const fetchDirectoryHistory = async ({
  limit,
  cursor = null,
  player = null,
}: {
  limit: number;
  cursor?: string | null;
  player?: string | null;
}): Promise<DirectoryHistoryPage> => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  if (player) query.set("player", player);
  const response = await fetch(`/api/directory/history?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`History answered ${response.status}`);
  return (await response.json()) as DirectoryHistoryPage;
};
