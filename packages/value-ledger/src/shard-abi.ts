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

type AbiField = { name: string; type: string };

export function assertAbiArguments(abi: Abi, entrypoint: string, args: Record<string, unknown>) {
  const entry = abi
    .flatMap((item) => (item.type === "interface" ? item.items : [item]))
    .find((item) => item.type === "function" && item.name === entrypoint);
  if (!entry) throw new Error(`shard_entrypoint_unknown:${entrypoint}`);
  assertAbiFields(abi, entry.inputs, args);
}

function assertAbiFields(abi: Abi, fields: AbiField[], value: Record<string, unknown>) {
  const unknown = Object.keys(value).find((key) => !fields.some((field) => field.name === key));
  if (unknown) throw new Error(`shard_argument_unknown:${unknown}`);
  for (const { name, type } of fields) {
    const members = abi.find((item) => item.type === "struct" && item.name === type)?.members;
    const nested = value[name];
    if (members && isRecord(nested)) assertAbiFields(abi, members, nested);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
