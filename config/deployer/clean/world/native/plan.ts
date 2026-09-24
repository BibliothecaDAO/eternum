import { CallData, type RpcProvider } from "starknet";
import { isClassDeclared, rpcErrorCode } from "../../shared/declare";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import type { NativePlan, NativeWorld } from "./types";

export async function inspectNativeWorld(local: NativeWorld, provider: RpcProvider): Promise<NativePlan> {
  const blockNumber = await provider.getBlockNumber();
  const blockers: string[] = [];
  const classes = await Promise.all(
    [...local.logic, { name: "games", ...local.games }].map(async ({ name, classHash }) => ({
      name,
      classHash,
      declared: await isClassDeclared(provider, classHash, blockNumber),
    })),
  );
  const deployedClassHash = await deployedClass(provider, local.games.address, blockNumber);
  if (deployedClassHash && BigInt(deployedClassHash) !== BigInt(local.games.classHash))
    blockers.push("Games is immutable; the deployed class differs from this release");
  let realmCatalogue: NativePlan["realmCatalogue"];
  if (deployedClassHash && blockers.length === 0) {
    await inspectGamesConfiguration(local, provider, blockNumber, blockers);
    realmCatalogue = await inspectRealmCatalogue(local, provider, blockNumber, blockers);
  }
  return {
    worldAddress: local.games.address,
    blockNumber,
    classes,
    deployedClassHash,
    realmCatalogue,
    blockers,
    synced:
      blockers.length === 0 &&
      classes.every(({ declared }) => declared) &&
      deployedClassHash !== null &&
      realmCatalogue?.initialized === canonicalRealmTraits.length,
  };
}

async function inspectGamesConfiguration(local: NativeWorld, provider: RpcProvider, block: number, blockers: string[]) {
  const codec = new CallData(local.games.sierra.abi);
  const read = async (entrypoint: string) =>
    codec.parse(
      entrypoint,
      await provider.callContract(
        {
          contractAddress: local.games.address,
          entrypoint,
          calldata: [],
        },
        block,
      ),
    );
  const authentication = (await read("authentication")) as Record<string, bigint>;
  if (!Object.entries(local.authentication).every(([name, value]) => authentication[name] === BigInt(value)))
    blockers.push("Games authentication mismatch");
  const configuration = (await read("deployment_configuration")) as {
    authority: bigint;
    classes: Record<string, bigint>;
  };
  if (configuration.authority !== BigInt(local.authority)) blockers.push("Games authority mismatch");
  if (!local.logic.every(({ name, classHash }) => configuration.classes[name] === BigInt(classHash)))
    blockers.push("Games initial logic release mismatch");
}

async function inspectRealmCatalogue(local: NativeWorld, provider: RpcProvider, block: number, blockers: string[]) {
  const raw = await provider.callContract(
    { contractAddress: local.games.address, entrypoint: "realm_catalogue", calldata: [] },
    block,
  );
  const catalogue = new CallData(local.games.sierra.abi).parse("realm_catalogue", raw) as {
    initialized: bigint;
    digest: bigint;
  };
  if (catalogue.initialized > BigInt(canonicalRealmTraits.length))
    blockers.push("Games realm catalogue exceeds canonical count");
  else if (BigInt(realmCatalogueDigest(Number(catalogue.initialized))) !== catalogue.digest)
    blockers.push("Games realm catalogue content mismatch");
  return { initialized: Number(catalogue.initialized), digest: `0x${catalogue.digest.toString(16)}` };
}

async function deployedClass(provider: RpcProvider, address: string, block: number): Promise<string | null> {
  try {
    return await provider.getClassHashAt(address, block);
  } catch (error) {
    if (rpcErrorCode(error) === 20) return null;
    throw error;
  }
}
