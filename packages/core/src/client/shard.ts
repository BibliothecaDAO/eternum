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
  releaseSchemas: Readonly<Record<string, string>>;
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

/** Read the manifest once; individual games resolve their own pins against its release catalogue. */
export async function openShard(url: string, schemaHash: string): Promise<Shard> {
  const shard = await readShard(url);
  if (!Object.values(shard.releaseSchemas).includes(schemaHash))
    throw new ShardReleaseMismatchError(shard.url, Object.keys(shard.releaseSchemas).join(", "));
  return registerShard(shard);
}

/** Re-read the release catalogue without replacing the shared shard registry or fetching decoder bytes. */
export async function refreshShardRelease(url: string, releaseId: string, schemaHash: string): Promise<Shard> {
  const shard = await readShard(url);
  if (shard.releaseSchemas[releaseId] !== schemaHash) throw new ShardReleaseMismatchError(shard.url, releaseId);
  return shard;
}

async function readShard(url: string): Promise<Shard> {
  const shardUrl = resolveEndpoint(url, { name: "Shard URL" });
  const response = await fetch(`${shardUrl}/manifest`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Shard ${shardUrl} manifest failed: ${response.status} ${response.statusText}`);
  return buildShard(shardUrl, (await response.json()) as ShardManifest);
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
    releaseSchemas: manifest.releaseSchemas,
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
