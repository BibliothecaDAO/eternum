import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
export interface RegisteredShard {
  chainId: string;
  url: string;
  status: "pending" | "active" | "draining" | "retired";
}
export interface ShardDirectory {
  shards(): Promise<RegisteredShard[]>;
}
export const activeShards = async (directory: ShardDirectory) =>
  (await directory.shards()).filter((row) => row.status === "active" || row.status === "draining");
export const requireActiveChain = async (directory: ShardDirectory, chainId: string) => {
  const row = (await activeShards(directory)).find((row) => BigInt(row.chainId) === BigInt(chainId));
  if (!row) throw new Error("unlisted_or_inactive_shard");
  return row;
};
/** Identity owns membership and URL; only Herald supplies the current RPC and contracts. */
export const readRegisteredShard = async (
  directory: ShardDirectory,
  chainId: string,
  network: typeof fetch = fetch,
) => {
  const rows = (await directory.shards()).filter((row) => BigInt(row.chainId) === BigInt(chainId));
  if (rows.length !== 1) throw new Error("unlisted_shard");
  const row = rows[0]!;
  const url = new URL("/manifest", row.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_directory_shard_url");
  const response = await network(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
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
  return { ...manifest, url: row.url, status: row.status };
};
