import { CallData, hash, type RawArgs, type RpcProvider } from "starknet";
import { isClassDeclared, rpcErrorCode } from "../shared/declare";
import { byteArrayHash } from "./artifacts";
import type { LocalResource, LocalWorld, ResourceComparison, WorldPlan } from "./types";

const RESOURCE_VARIANTS = { model: 0, event: 1, contract: 2, library: 6 } as const;
const felt = (value: string) => `0x${BigInt(value).toString(16)}`;

export async function classHashAt(
  provider: RpcProvider,
  address: string,
  block: number | "latest" = "latest",
): Promise<string | null> {
  try {
    return felt(await provider.getClassHashAt(address, block));
  } catch (error) {
    if (rpcErrorCode(error) === 20) return null;
    throw error;
  }
}

export async function inspectWorld(local: LocalWorld, provider: RpcProvider): Promise<WorldPlan> {
  const blockNumber = await provider.getBlockNumber();
  const chainClassHash = await classHashAt(provider, local.address, blockNumber);
  const world: ResourceComparison = {
    tag: "world",
    kind: "world",
    selector: "0x0",
    localClassHash: local.world.classHash,
    chainClassHash,
    address: local.address,
    declared: await isClassDeclared(provider, local.world.classHash, blockNumber),
    initialized: true,
    action:
      chainClassHash === null
        ? "deploy"
        : BigInt(chainClassHash) === BigInt(local.world.classHash)
          ? "synced"
          : "upgrade",
  };
  const initialized = chainClassHash
    ? await initializedContracts(provider, local.address, blockNumber)
    : new Set<string>();
  const resources = [world];
  const blockers: string[] = [];
  for (const resource of local.resources) {
    const comparison = await inspectResource(
      local,
      resource,
      provider,
      blockNumber,
      chainClassHash !== null,
      initialized,
    );
    resources.push(comparison);
    if (comparison.action === "blocked")
      blockers.push(
        `Library ${resource.tag} is immutable: on-chain ${comparison.chainClassHash}, local ${comparison.localClassHash}; use a new version through a separate contract change`,
      );
  }
  const namespace = chainClassHash
    ? await worldRead(provider, local, "resource", [byteArrayHash(local.profile.namespace.default)], blockNumber)
    : ["5"];
  if (![3, 5].includes(Number(namespace[0])))
    throw new Error("Namespace selector is occupied by a different resource kind");
  const writers = await inspectWriters(local, resources, provider, blockNumber, chainClassHash !== null);
  return {
    worldAddress: local.address,
    blockNumber,
    resources,
    namespaceRegistered: Number(namespace[0]) === 3,
    writers,
    blockers,
  };
}

async function inspectResource(
  local: LocalWorld,
  resource: LocalResource,
  provider: RpcProvider,
  block: number,
  worldExists: boolean,
  initialized: Set<string>,
): Promise<ResourceComparison> {
  const state = worldExists ? await worldRead(provider, local, "resource", [resource.selector], block) : ["5"];
  const registered = Number(state[0]) !== 5;
  if (registered && Number(state[0]) !== RESOURCE_VARIANTS[resource.kind])
    throw new Error(`Resource kind mismatch for ${resource.tag}`);
  const address =
    resource.kind === "library"
      ? null
      : registered
        ? felt(state[1])
        : resource.kind === "contract"
          ? hash.calculateContractAddressFromHash(resource.selector, resource.classHash, [], local.address)
          : null;
  const chainClassHash = !registered
    ? null
    : resource.kind === "library"
      ? felt(state[1])
      : await classHashAt(provider, address!, block);
  if (registered && chainClassHash === null)
    throw new Error(`Registered resource ${resource.tag} has no deployed class`);
  const changed = chainClassHash !== null && BigInt(chainClassHash) !== BigInt(resource.classHash);
  return {
    tag: resource.tag,
    kind: resource.kind,
    selector: resource.selector,
    localClassHash: resource.classHash,
    chainClassHash,
    address,
    declared: await isClassDeclared(provider, resource.classHash, block),
    initialized: resource.kind !== "contract" || initialized.has(felt(resource.selector)),
    action: !registered ? "register" : changed ? (resource.kind === "library" ? "blocked" : "upgrade") : "synced",
  };
}

async function initializedContracts(provider: RpcProvider, address: string, blockNumber: number): Promise<Set<string>> {
  const selectors = new Set<string>();
  let continuation_token: string | undefined;
  do {
    const page = await provider.getEvents({
      address,
      from_block: { block_number: 0 },
      to_block: { block_number: blockNumber },
      keys: [[hash.getSelectorFromName("ContractInitialized")]],
      chunk_size: 1000,
      continuation_token,
    });
    for (const event of page.events) {
      if (!event.keys[1]) throw new Error("ContractInitialized event is missing its selector");
      selectors.add(felt(event.keys[1]));
    }
    continuation_token = page.continuation_token;
  } while (continuation_token);
  return selectors;
}

async function inspectWriters(
  local: LocalWorld,
  resources: ResourceComparison[],
  provider: RpcProvider,
  block: number,
  worldExists: boolean,
) {
  const byTag = new Map(resources.map((resource) => [resource.tag, resource]));
  const writers: WorldPlan["writers"] = [];
  for (const [target, contracts] of Object.entries(local.profile.writers)) {
    const selector = target === local.profile.namespace.default ? byteArrayHash(target) : byTag.get(target)!.selector;
    for (const tag of new Set(contracts)) {
      const address = byTag.get(tag)!.address!;
      const result = worldExists ? await worldRead(provider, local, "is_writer", [selector, address], block) : ["0"];
      writers.push({ resource: selector, contract: address, granted: BigInt(result[0]) === 1n });
    }
  }
  return writers;
}

export function worldCall(local: LocalWorld, entrypoint: string, args: Record<string, unknown>) {
  return {
    contractAddress: local.address,
    entrypoint,
    calldata: new CallData(local.world.sierra.abi).compile(entrypoint, args as RawArgs),
  };
}

async function worldRead(
  provider: RpcProvider,
  local: LocalWorld,
  entrypoint: string,
  calldata: string[],
  block: number,
) {
  return provider.callContract({ contractAddress: local.address, entrypoint, calldata }, block);
}
