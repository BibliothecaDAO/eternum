import { RpcError } from "starknet";
export interface CacheAnchor {
  number: number;
  hash: string;
}
/** A transport outage cannot prove a cache valid; only a missing/replaced block proves it obsolete. */
export async function cacheAnchorMatches(anchor: CacheAnchor | undefined, read: (number: number) => Promise<string>) {
  if (!anchor || !Number.isSafeInteger(anchor.number) || anchor.number < 0 || typeof anchor.hash !== "string")
    return false;
  try {
    return BigInt(await read(anchor.number)) === BigInt(anchor.hash);
  } catch (error) {
    if (error instanceof RpcError && error.isType("BLOCK_NOT_FOUND")) return false;
    throw error;
  }
}
