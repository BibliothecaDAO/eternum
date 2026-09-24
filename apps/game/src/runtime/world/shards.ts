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

const openedShard = (chainId: string): Shard | undefined => getShards().find((shard) => shard.chainId === chainId);

/**
 * A game route names only a chain id. Its shard is found in our directory and opened alone, so entering a game talks
 * to that game's Herald and no other; a shard the player pasted is opened when the chain is not ours.
 */
export const requireOpenShard = async (chainId: string): Promise<Shard> => {
  const open = openedShard(chainId);
  if (open) return open;
  const listed = listedShards(await directoryListing()).find((shard) => BigInt(shard.chainId) === BigInt(chainId));
  if (listed) return openShard(listed.url, nativeFactSchemaIdentity);
  await openPastedShards();
  return requireShard(chainId);
};

/** Every shard this client knows, opened: our directory's and the player's pasted ones; failures by URL, never hidden. */
export const openKnownShards = async (): Promise<ShardOpenFailure[]> => {
  const failures: ShardOpenFailure[] = [];
  let listed: string[] = [];
  try {
    listed = listedShards(await directoryListing()).map((shard) => shard.url);
  } catch (error) {
    failures.push({ url: DIRECTORY_URL, error: toError(error) });
  }
  return [...failures, ...(await openShardUrls([...new Set([...listed, ...readPastedShardUrls()])]))];
};

/** The player's pasted shards, opened; a mistyped or dead one is reported by URL. */
export const openPastedShards = (): Promise<ShardOpenFailure[]> => openShardUrls(readPastedShardUrls());

export const listOpenShards = (): Shard[] => getShards();

/** Shards the player pasted, apart from the ones our directory lists. */
export const listPastedShards = (): Shard[] => {
  const pasted = new Set(readPastedShardUrls());
  return getShards().filter((shard) => pasted.has(shard.url));
};

/** A pasted shard is remembered only once it opened, so a mistyped URL never persists. */
export const addPastedShard = async (url: string): Promise<Shard> => {
  const shard = await openShard(url, nativeFactSchemaIdentity);
  writePastedShardUrls([...new Set([...readPastedShardUrls(), shard.url])]);
  return shard;
};

const openShardUrls = async (urls: string[]): Promise<ShardOpenFailure[]> => {
  const unopened = urls.filter((url) => !getShards().some((shard) => shard.url === url));
  const results = await Promise.allSettled(unopened.map((url) => openShard(url, nativeFactSchemaIdentity)));
  return results.flatMap((result, index) =>
    result.status === "rejected" ? [{ url: unopened[index], error: toError(result.reason) }] : [],
  );
};

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
