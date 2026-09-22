import { getShards, openShard, requireShard, type Shard } from "@bibliothecadao/eternum/game-client";
import { resolveEndpoint } from "@realms-world/chain";

import { env } from "../../../env";
import { nativeBindings } from "./native-bindings";

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

/** The shard a player acts on before choosing a game: this build's default shard. */
export const openDefaultShard = async (): Promise<Shard> => {
  const failures = await openKnownShards();
  const defaultShard = listOpenShards().find((shard) => shard.url === resolveShardUrl(env.VITE_PUBLIC_SHARD_URL));
  if (defaultShard) return defaultShard;
  throw (
    failures.find((failure) => failure.url === env.VITE_PUBLIC_SHARD_URL)?.error ??
    new Error("Default shard is not open")
  );
};

/** A pasted shard is remembered only once it opened, so a mistyped URL never persists. */
export const addPastedShard = async (url: string): Promise<Shard> => {
  const shard = await openShard(url, nativeBindings.schemaIdentity);
  writePastedShardUrls([...new Set([...readPastedShardUrls(), shard.url])]);
  return shard;
};

const knownShardUrls = (): string[] => [...new Set([env.VITE_PUBLIC_SHARD_URL, ...readPastedShardUrls()])];

const openShardUrls = async (urls: string[]): Promise<ShardOpenFailure[]> => {
  const results = await Promise.allSettled(urls.map((url) => openShard(url, nativeBindings.schemaIdentity)));
  return results.flatMap((result, index) =>
    result.status === "rejected" ? [{ url: urls[index], error: toError(result.reason) }] : [],
  );
};

const resolveShardUrl = (url: string): string => resolveEndpoint(url, { name: "Shard URL" });

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
