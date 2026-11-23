import { resolveEndpoint } from "@realms-world/chain";

import type { NativeReleases, ShardManifest } from "../sync/herald-http-types";

/**
 * A shard is one chain with its games, reached through one URL: its Herald. Everything else a client needs — the
 * chain id, the node endpoint players send their signed invokes to, the contracts and the release — comes from the
 * manifest Herald serves.
 * A game is named by (chain id, game id) because game ids are only unique within a shard.
 */
export interface Shard {
  /** Herald's origin: games directory, snapshots, history and the game streams live under it. */
  url: string;
  chainId: string;
  releases: NativeReleases;
  rpcUrl: string;
  accountClassHash: string;
  /** The key that authorizes device keys on this shard's Realms accounts; with the class, it fixes their addresses. */
  guardianPublicKey: string;
  contracts: Record<string, string>;
  /** The contract every game command enters through. */
  worldAddress: string;
  /** The l2 gas max_amount of every play; the shard takes no other bounds. */
  l2GasBound: bigint;
}

export interface GameRef {
  chainId: string;
  gameId: number;
}

/** The shard runs a release whose facts this client was not compiled to read. */
export class ShardReleaseMismatchError extends Error {
  constructor(
    readonly shardUrl: string,
    readonly releaseId: string,
    reason = "has no decoder in this client",
  ) {
    super(`UNKNOWN_RELEASE_SCHEMA: shard ${shardUrl} release ${releaseId} ${reason}`);
    this.name = "ShardReleaseMismatchError";
  }
}

export class GameOnOlderNumbersError extends ShardReleaseMismatchError {
  constructor(shardUrl: string, releaseId: string) {
    super(shardUrl, releaseId, "runs older balance numbers than this client");
    this.name = "GameOnOlderNumbersError";
  }
}

const ENTRYPOINT_CONTRACT = "games";

let opened: Shard | null = null;

/** Chain ids arrive as felts in any hex spelling; one spelling keys URLs, storage and lookups. */
const normalizeChainId = (chainId: string | bigint): string => `0x${BigInt(chainId).toString(16)}`;

/**
 * Open a shard from its manifest, read once: the one its listing already carries (the app's directory serves it, so
 * entering a game does not wait on a second round trip to the shard), or else the shard's own. Individual games
 * resolve their own pins against its release catalogue.
 */
export async function openShard(
  url: string,
  schemaHash: string,
  validate?: (shard: Shard) => void,
  listedManifest?: ShardManifest,
): Promise<Shard> {
  const shard = listedManifest
    ? buildShard(resolveEndpoint(url, { name: "Shard URL" }), listedManifest)
    : await readShard(url);
  if (!Object.values(shard.releases).some(({ schema }) => schema === schemaHash))
    throw new ShardReleaseMismatchError(shard.url, Object.keys(shard.releases).join(", "));
  validate?.(shard);
  return registerShard(shard);
}

/** Re-read the release catalogue without replacing the shared shard registry or fetching decoder bytes. */
export async function refreshShardRelease(url: string, releaseId: string, schemaHash: string): Promise<Shard> {
  const shard = await readShard(url);
  if (shard.releases[releaseId]?.schema !== schemaHash) throw new ShardReleaseMismatchError(shard.url, releaseId);
  return shard;
}

async function readShard(url: string): Promise<Shard> {
  const shardUrl = resolveEndpoint(url, { name: "Shard URL" });
  const response = await fetch(`${shardUrl}/manifest`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Shard ${shardUrl} manifest failed: ${response.status} ${response.statusText}`);
  return buildShard(shardUrl, (await response.json()) as ShardManifest);
}

export const getShard = (): Shard | null => opened;

/** A game is always played on its own shard; never redirect it to another. */
export const requireShard = (): Shard => {
  if (!opened) throw new Error("No shard is open");
  return opened;
};

const buildShard = (url: string, manifest: ShardManifest): Shard => {
  if (manifest.version !== 1) throw new Error(`Shard ${url} serves manifest version ${manifest.version}`);
  const worldAddress = manifest.contracts[ENTRYPOINT_CONTRACT];
  if (!worldAddress) throw new Error(`Shard ${url} manifest names no ${ENTRYPOINT_CONTRACT} contract`);
  if (typeof manifest.releases !== "object" || manifest.releases === null)
    throw new Error(`Shard ${url} manifest names no releases; its Herald predates release families`);
  return {
    url,
    chainId: normalizeChainId(manifest.chainId),
    releases: manifest.releases,
    rpcUrl: resolveEndpoint(manifest.rpcUrl, { name: `RPC URL of shard ${url}` }),
    accountClassHash: manifest.accountClassHash,
    guardianPublicKey: manifest.guardianPublicKey,
    contracts: manifest.contracts,
    worldAddress,
    l2GasBound: playGasBound(url, manifest.l2GasBound),
  };
};

/** The shard's play bound is required: a missing or zero bound would sign invokes the shard refuses. */
const playGasBound = (url: string, bound: string | undefined): bigint => {
  if (typeof bound !== "string" || !/^0x[0-9a-f]+$/i.test(bound) || BigInt(bound) === 0n || BigInt(bound) >= 2n ** 64n)
    throw new Error(`Shard ${url} manifest has no valid l2GasBound`);
  return BigInt(bound);
};

const registerShard = (shard: Shard): Shard => {
  if (opened && (opened.chainId !== shard.chainId || opened.url !== shard.url))
    throw new Error(`Shard ${opened.url} on chain ${opened.chainId} is open; ${shard.url} cannot open beside it`);
  opened = shard;
  return shard;
};
