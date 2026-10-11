import { getShards, openShard, requireShard, type Shard } from "@bibliothecadao/eternum/shard";

import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { fetchDirectory, listedShards, type DirectoryShard } from "./directory";

const DIRECTORY_URL = "/api/directory";

export interface ShardOpenFailure {
  url: string;
  error: Error;
}

let listing: Promise<DirectoryShard[]> | null = null;

/** Our directory, read once per page; a read that failed is retried by the next caller. */
const directoryListing = (): Promise<DirectoryShard[]> =>
  (listing ??= fetchDirectory().catch((error: unknown) => {
    listing = null;
    throw error;
  }));

const openedShard = (chainId: string): Shard | undefined =>
  getShards().find((shard) => BigInt(shard.chainId) === BigInt(chainId));

/**
 * A game route names only a chain id. Its shard is found in our directory and opened alone, so entering a game talks
 * to that game's Herald and no other. A chain our directory does not list plays only on a shard already open here.
 */
export const requireOpenShard = async (chainId: string): Promise<Shard> => {
  const directory = await directoryListing();
  const listed = directory.find((shard) => BigInt(shard.chainId) === BigInt(chainId));
  if (!listed) return requireShard(chainId);
  const open = openedShard(chainId);
  return open && new URL(open.url).href === new URL(listed.url).href ? open : openListedShard(listed);
};

/** Every shard our directory lists, opened; failures by URL, never hidden. */
export const openKnownShards = async (): Promise<ShardOpenFailure[]> => {
  let directory: DirectoryShard[];
  try {
    directory = await directoryListing();
  } catch (error) {
    return [{ url: DIRECTORY_URL, error: toError(error) }];
  }
  const unopened = listedShards(directory).filter((entry) => !getShards().some((shard) => shard.url === entry.url));
  const results = await Promise.allSettled(unopened.map(openListedShard));
  return results.flatMap((result, index) =>
    result.status === "rejected" ? [{ url: unopened[index].url, error: toError(result.reason) }] : [],
  );
};

export const listOpenShards = (): Shard[] => getShards();

/** Validate before registry insertion: a shard whose manifest names another chain than its listed one owns no route. */
const openListedShard = (listed: DirectoryShard): Promise<Shard> =>
  openShard(listed.url, nativeFactSchemaIdentity, (shard) => {
    if (BigInt(listed.chainId) !== BigInt(shard.chainId))
      throw new Error(`Shard ${shard.url} does not serve its listed chain ${listed.chainId}`);
  });

const toError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(String(reason)));
