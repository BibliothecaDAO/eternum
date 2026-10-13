import type { Abi, RpcProvider } from "starknet";

let cached: { hash: string; abi: Abi } | undefined;

/** Class content is immutable; the address-to-class binding is checked at every requested block. */
export async function readShardAbi(provider: RpcProvider, address: string, block: number): Promise<Abi> {
  const hash = BigInt(await provider.getClassHashAt(address, block)).toString(16);
  if (cached?.hash === hash) return cached.abi;
  const contract = await provider.getClassByHash(`0x${hash}`);
  const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
  if (!Array.isArray(abi)) throw new Error("shard_abi_unavailable");
  cached = { hash, abi: abi as Abi };
  return cached.abi;
}
