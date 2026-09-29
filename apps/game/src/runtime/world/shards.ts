import { getShards, openShard, requireShard, type Shard } from "@bibliothecadao/eternum/shard";

import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { fetchDirectory, listedShards, type DirectoryShard } from "./directory";

const PASTED_SHARDS_KEY = "PASTED_SHARD_URLS";
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
 * to that game's Herald and no other; a shard the player pasted is opened when the chain is not ours.
 */
export const requireOpenShard = async (chainId: string): Promise<Shard> => {
  const directory = await directoryListing();
  const listed = directory.find((shard) => BigInt(shard.chainId) === BigInt(chainId));
  if (listed) {
    const open = openedShard(chainId);
    return open && new URL(open.url).href === new URL(listed.url).href
      ? open
      : openDirectoryShard(listed.url, directory);
  }
  const open = openedShard(chainId);
  if (open) return open;
  await openPastedShards();
  return requireShard(chainId);
};

/** Every shard this client knows, opened: our directory's and the player's pasted ones; failures by URL, never hidden. */
export const openKnownShards = async (): Promise<ShardOpenFailure[]> => {
  let directory: DirectoryShard[];
  try {
    directory = await directoryListing();
  } catch (error) {
    return [{ url: DIRECTORY_URL, error: toError(error) }];
  }
  const urls = [...new Set([...listedShards(directory).map((shard) => shard.url), ...readPastedShardUrls()])];
  return openShardUrls(urls, directory);
};

/** Pasted shards cannot claim a chain reserved by the directory, including retired chains. */
export const openPastedShards = async (): Promise<ShardOpenFailure[]> => {
  const urls = readPastedShardUrls();
  if (urls.length === 0) return [];
  try {
    return await openShardUrls(urls, await directoryListing());
  } catch (error) {
    return [{ url: DIRECTORY_URL, error: toError(error) }];
  }
};

export const listOpenShards = (): Shard[] => getShards();

/** Shards the player pasted, apart from the ones our directory lists. */
export const listPastedShards = (): Shard[] => {
  const pasted = new Set(readPastedShardUrls());
  return getShards().filter((shard) => pasted.has(shard.url));
};

/** A pasted shard is remembered only once it opened, so a mistyped URL never persists. */
export const addPastedShard = async (url: string): Promise<Shard> => {
  const shard = await openDirectoryShard(url, await directoryListing());
  writePastedShardUrls([...new Set([...readPastedShardUrls(), shard.url])]);
  return shard;
};

const openShardUrls = async (urls: string[], directory: DirectoryShard[]): Promise<ShardOpenFailure[]> => {
  const unopened = urls.filter((url) => !getShards().some((shard) => shard.url === url));
  const results = await Promise.allSettled(unopened.map((url) => openDirectoryShard(url, directory)));
  return results.flatMap((result, index) =>
    result.status === "rejected" ? [{ url: unopened[index], error: toError(result.reason) }] : [],
  );
};

/** Validate before registry insertion: a rejected manifest must never own a route. */
const openDirectoryShard = (url: string, directory: DirectoryShard[]): Promise<Shard> =>
  openShard(url, nativeFactSchemaIdentity, (shard) => {
    const owner = directory.find((entry) => BigInt(entry.chainId) === BigInt(shard.chainId));
    if (owner && new URL(owner.url).href !== new URL(shard.url).href)
      throw new Error(`Chain ${shard.chainId} belongs to listed shard ${owner.url}`);
    const listed = directory.find((entry) => new URL(entry.url).href === new URL(shard.url).href);
    if (listed && BigInt(listed.chainId) !== BigInt(shard.chainId))
      throw new Error(`Shard ${shard.url} does not serve its listed chain ${listed.chainId}`);
  });

const toError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(String(reason)));

const readPastedShardUrls = (): string[] => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PASTED_SHARDS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((url): url is string => typeof url === "string") : [];
  } catch {
    return [];
  }
};

const writePastedShardUrls = (urls: string[]) => {
  try {
    localStorage.setItem(PASTED_SHARDS_KEY, JSON.stringify(urls));
  } catch {
    // Without storage the pasted shard stays open for this page only.
  }
};
