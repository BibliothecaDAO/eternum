import type { Abi, BlockIdentifier, RpcProvider } from "starknet";

let cached: { hash: string; abi: Abi } | undefined;

/** A class's ABI, read by its hash. */
export async function readClassAbi(provider: RpcProvider, classHash: string): Promise<Abi> {
  const contract = await provider.getClassByHash(classHash);
  const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
  if (!Array.isArray(abi)) throw new Error("shard_abi_unavailable");
  return abi as Abi;
}

/** Class content is immutable; the address-to-class binding is checked at every requested block. */
export async function readShardAbi(provider: RpcProvider, address: string, block: BlockIdentifier): Promise<Abi> {
  const hash = BigInt(await provider.getClassHashAt(address, block)).toString(16);
  if (cached?.hash === hash) return cached.abi;
  cached = { hash, abi: await readClassAbi(provider, `0x${hash}`) };
  return cached.abi;
}
