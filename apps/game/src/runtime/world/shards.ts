import { getShards, openShard, requireShard, type Shard } from "@bibliothecadao/eternum/shard";

import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { env } from "../../../env";

const PASTED_SHARDS_KEY = "PASTED_SHARD_URLS";

interface ShardOpenFailure {
  url: string;
  error: Error;
}

let opening: Promise<ShardOpenFailure[]> | null = null;

/**
 * The shards this client knows: our default shard and every shard URL the player pasted. Each opens once per page;
 * one that cannot be opened is reported by URL, never hidden behind an empty list.
 */
export const openKnownShards = (): Promise<ShardOpenFailure[]> =>
  (opening ??= openShardUrls(knownShardUrls()).then((failures) => {
    // A shard that was down is retried by the next caller instead of staying missing for the page's life.
    if (failures.length > 0) opening = null;
    return failures;
  }));

export const listOpenShards = (): Shard[] => getShards();

/** A game route names only a chain id, so every known shard is opened before one is looked up. */
export const requireOpenShard = async (chainId: string): Promise<Shard> => {
  await openKnownShards();
  return requireShard(chainId);
};

/** A pasted shard is remembered only once it opened, so a mistyped URL never persists. */
export const addPastedShard = async (url: string): Promise<Shard> => {
  const shard = await openShard(url, nativeFactSchemaIdentity);
  writePastedShardUrls([...new Set([...readPastedShardUrls(), shard.url])]);
  return shard;
};

const knownShardUrls = (): string[] => [...new Set([env.VITE_PUBLIC_SHARD_URL, ...readPastedShardUrls()])];

const openShardUrls = async (urls: string[]): Promise<ShardOpenFailure[]> => {
  const results = await Promise.allSettled(urls.map((url) => openShard(url, nativeFactSchemaIdentity)));
  return results.flatMap((result, index) =>
    result.status === "rejected" ? [{ url: urls[index], error: toError(result.reason) }] : [],
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
