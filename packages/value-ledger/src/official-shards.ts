import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
export interface RegisteredShard {
  chainId: string;
  url: string;
}
export interface ShardDirectory {
  shard(): Promise<RegisteredShard | null>;
}
export const officialChain = (directory: ShardDirectory): Promise<RegisteredShard | null> => directory.shard();
export const requireActiveChain = async (directory: ShardDirectory, chainId: string) => {
  const row = await officialChain(directory);
  if (!row || BigInt(row.chainId) !== BigInt(chainId)) throw new Error("unlisted_or_inactive_shard");
  return row;
};
/** Identity owns membership and URL; only Herald supplies the current RPC and contracts. */
export const readRegisteredShard = async (
  directory: ShardDirectory,
  chainId: string,
  network: typeof fetch = fetch,
) => {
  const row = await directory.shard();
  if (!row || BigInt(row.chainId) !== BigInt(chainId)) throw new Error("unlisted_shard");
  const url = new URL("/manifest", row.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_directory_shard_url");
  const response = await network(url, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch((cause: unknown) => {
    throw new Error("directory_shard_manifest_fetch_failed", { cause });
  });
  if (!response.ok) throw new Error("directory_shard_manifest_unavailable");
  const manifest = (await response.json()) as ShardManifest;
  if (
    manifest.version !== 1 ||
    !/^0x[0-9a-f]+$/i.test(manifest.chainId) ||
    BigInt(manifest.chainId) !== BigInt(row.chainId)
  )
    throw new Error("directory_manifest_chain_differs");
  if (
    ![manifest.contracts?.games, manifest.accountClassHash, manifest.guardianPublicKey].every(
      (value) => typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) && BigInt(value) > 0n,
    )
  )
    throw new Error("invalid_directory_shard_manifest");
  const rpc = new URL(manifest.rpcUrl);
  if (rpc.protocol !== "https:" || rpc.username || rpc.password) throw new Error("invalid_directory_shard_rpc");
  return { ...manifest, url: row.url };
};
