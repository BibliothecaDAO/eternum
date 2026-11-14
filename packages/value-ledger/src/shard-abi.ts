import type { Abi, BlockIdentifier, RpcProvider } from "starknet";

/** Class content is immutable. The ledger and each shard are different classes, so a few stay; the oldest leaves first. */
const KEPT_CLASSES = 4;
const cached = new Map<string, Abi>();

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
  const known = cached.get(hash);
  if (known) return known;
  const abi = await readClassAbi(provider, `0x${hash}`);
  if (cached.size >= KEPT_CLASSES) cached.delete(cached.keys().next().value!);
  cached.set(hash, abi);
  return abi;
}
