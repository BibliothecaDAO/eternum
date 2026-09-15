import { CallData, type RpcProvider } from "starknet";
import { isClassDeclared, rpcErrorCode } from "../../shared/declare";
import { nativePeers } from "./artifacts";
import type { NativeDomain, NativeDomainPlan, NativePlan, NativeWorld } from "./types";

export async function inspectNativeWorld(local: NativeWorld, provider: RpcProvider): Promise<NativePlan> {
  const blockNumber = await provider.getBlockNumber();
  const blockers: string[] = [];
  const domains: NativeDomainPlan[] = [];
  for (const domain of local.domains) domains.push(await inspectDomain(local, domain, provider, blockNumber, blockers));
  return {
    worldAddress: nativePeers(local).season,
    blockNumber,
    domains,
    blockers,
    synced:
      blockers.length === 0 &&
      domains.every((domain) => domain.active && domain.configured && domain.chainClassHash === domain.localClassHash),
  };
}

async function inspectDomain(
  local: NativeWorld,
  domain: NativeDomain,
  provider: RpcProvider,
  block: number,
  blockers: string[],
) {
  const declared = await isClassDeclared(provider, domain.classHash, block);
  const chainClassHash = await deployedClass(provider, domain.address, block);
  const plan: NativeDomainPlan = {
    name: domain.name,
    address: domain.address,
    localClassHash: domain.classHash,
    chainClassHash,
    declared,
    configured: false,
    active: false,
  };
  if (!chainClassHash) return plan;
  if (
    BigInt(chainClassHash) !== BigInt(domain.classHash) &&
    !local.previous?.native.domains[domain.name]?.classes[chainClassHash]
  )
    blockers.push(`${domain.name}: deployed class is not in the release history`);
  const codec = new CallData(domain.sierra.abi);
  const state = codec.parse(
    "domain_state",
    await provider.callContract({ contractAddress: domain.address, entrypoint: "domain_state", calldata: [] }, block),
  ) as {
    authority: bigint;
    peers: Record<string, bigint>;
    active: boolean;
  };
  if (BigInt(state.authority) !== BigInt(local.authority)) blockers.push(`${domain.name}: authority mismatch`);
  plan.configured = BigInt(state.peers.season) !== 0n;
  plan.active = state.active;
  if (plan.configured && !sameAddresses(state.peers, nativePeers(local)))
    blockers.push(`${domain.name}: peer mismatch`);
  if (plan.active && !plan.configured) blockers.push(`${domain.name}: active without configured peers`);
  if (domain.name === "season") {
    const actual = codec.parse(
      "authentication",
      await provider.callContract(
        { contractAddress: domain.address, entrypoint: "authentication", calldata: [] },
        block,
      ),
    ) as Record<string, bigint>;
    if (!sameAddresses(actual, { ...local.authentication })) blockers.push("season: authentication mismatch");
  }
  return plan;
}
function sameAddresses(actual: Record<string, bigint>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(
    ([key, value]) => actual[key] !== undefined && BigInt(actual[key]) === BigInt(value),
  );
}
async function deployedClass(provider: RpcProvider, address: string, block: number): Promise<string | null> {
  try {
    return await provider.getClassHashAt(address, block);
  } catch (error) {
    if (rpcErrorCode(error) === 20) return null;
    throw error;
  }
}
