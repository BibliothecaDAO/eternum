import { resolveEndpoint } from "@realms-world/chain";

import type { ShardManifest } from "../sync/herald-http-types";

/**
 * A shard is one chain with its games, reached through one URL: its Herald. Everything else a client needs — the
 * chain id, the node and admission endpoints, the contracts and the release — comes from the manifest Herald serves.
 * A game is named by (chain id, game id) because game ids are only unique within a shard.
 */
export interface Shard {
  /** Herald's origin: games directory, snapshots, history and the game streams live under it. */
  url: string;
  chainId: string;
  releaseId: string;
  rpcUrl: string;
  admissionUrl: string;
  accountClassHash: string;
  /** The key that authorizes device keys on this shard's Realms accounts; with the class, it fixes their addresses. */
  guardianPublicKey: string;
  contracts: Record<string, string>;
  /** The contract every game command enters through. */
  worldAddress: string;
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
  ) {
    super(`UNKNOWN_RELEASE_SCHEMA: shard ${shardUrl} release ${releaseId} has no decoder in this client`);
    this.name = "ShardReleaseMismatchError";
  }
}

const ENTRYPOINT_CONTRACT = "games";

const shards = new Map<string, Shard>();

/** Chain ids arrive as felts in any hex spelling; one spelling keys URLs, storage and lookups. */
const normalizeChainId = (chainId: string | bigint): string => `0x${BigInt(chainId).toString(16)}`;

/** Read a shard's manifest, refuse a release this client cannot read, and make the shard addressable by chain id. */
export async function openShard(url: string, schemaHash: string): Promise<Shard> {
  return refreshShardRelease(url, undefined, schemaHash);
}

/** Re-read release and schema metadata before a newly pinned game can submit another action. */
export async function refreshShardRelease(
  url: string,
  releaseId: string | undefined,
  schemaHash: string,
): Promise<Shard> {
  const shardUrl = resolveEndpoint(url, { name: "Shard URL" });
  const response = await fetch(`${shardUrl}/manifest`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Shard ${shardUrl} manifest failed: ${response.status} ${response.statusText}`);
  const manifest = (await response.json()) as ShardManifest;
  const expectedRelease = releaseId ?? manifest.releaseId;
  if (manifest.releaseSchemas?.[expectedRelease] !== schemaHash)
    throw new ShardReleaseMismatchError(shardUrl, expectedRelease);
  const schemaResponse = await fetch(`${shardUrl}/schemas/${schemaHash}`, { signal: AbortSignal.timeout(10_000) });
  if (!schemaResponse.ok) throw new ShardReleaseMismatchError(shardUrl, expectedRelease);
  const { identity, ...schema } = await schemaResponse.json();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(schema)));
  const actual = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  if (identity !== schemaHash || actual !== schemaHash) throw new ShardReleaseMismatchError(shardUrl, expectedRelease);
  return registerShard(buildShard(shardUrl, manifest));
}

export const getShards = (): Shard[] => [...shards.values()];

export const getShard = (chainId: string | null | undefined): Shard | null =>
  chainId ? (shards.get(normalizeChainId(chainId)) ?? null) : null;

/** A game is always played on its own shard; never redirect it to another. */
export const requireShard = (chainId: string | null | undefined): Shard => {
  const shard = getShard(chainId);
  if (!shard) throw new Error(`Shard for chain ${chainId ?? ""} is not open`);
  return shard;
};

const buildShard = (url: string, manifest: ShardManifest): Shard => {
  if (manifest.version !== 1) throw new Error(`Shard ${url} serves manifest version ${manifest.version}`);
  const worldAddress = manifest.contracts[ENTRYPOINT_CONTRACT];
  if (!worldAddress) throw new Error(`Shard ${url} manifest names no ${ENTRYPOINT_CONTRACT} contract`);
  return {
    url,
    chainId: normalizeChainId(manifest.chainId),
    releaseId: manifest.releaseId,
    rpcUrl: resolveEndpoint(manifest.rpcUrl, { name: `RPC URL of shard ${url}` }),
    admissionUrl: resolveEndpoint(manifest.admissionUrl, { name: `Admission URL of shard ${url}` }),
    accountClassHash: manifest.accountClassHash,
    guardianPublicKey: manifest.guardianPublicKey,
    contracts: manifest.contracts,
    worldAddress,
  };
};

const registerShard = (shard: Shard): Shard => {
  const existing = shards.get(shard.chainId);
  if (existing && existing.url !== shard.url)
    throw new Error(`Shards ${existing.url} and ${shard.url} both claim chain ${shard.chainId}`);
  shards.set(shard.chainId, shard);
  return shard;
};
