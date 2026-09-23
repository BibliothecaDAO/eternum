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

/** The shards the directory still serves: retired ones are history. */
export const listedShards = (shards: readonly DirectoryShard[]): DirectoryShard[] =>
  shards.filter((shard) => shard.status !== "retired");
