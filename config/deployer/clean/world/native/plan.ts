import { assertHotfixSchema } from "./artifacts";
import { CallData, type RpcProvider } from "starknet";
import { isClassDeclared, rpcErrorCode } from "../../shared/declare";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import type { NativePlan, NativeWorld } from "./types";

export async function inspectNativeWorld(local: NativeWorld, provider: RpcProvider): Promise<NativePlan> {
  assertHotfixSchema(local.release, local.previous);
  const blockNumber = await provider.getBlockNumber();
  const blockers: string[] = [];
  const classes = await Promise.all(
    [...local.logic, ...(local.migration ? [local.migration] : []), { name: "games", ...local.games }].map(
      async ({ name, classHash }) => ({
        name,
        classHash,
        declared: await isClassDeclared(provider, classHash, blockNumber),
      }),
    ),
  );
  const deployedClassHash = await deployedClass(provider, local.games.address, blockNumber);
  if (deployedClassHash && BigInt(deployedClassHash) !== BigInt(local.games.classHash))
    blockers.push("Games is immutable; the deployed class differs from this release");
  let realmCatalogue: NativePlan["realmCatalogue"];
  let releaseRegistered = false;
  let submitterRotation: NativePlan["submitterRotation"];
  if (deployedClassHash && blockers.length === 0) {
    submitterRotation = await inspectGamesConfiguration(local, provider, blockNumber, blockers);
    releaseRegistered = await inspectRelease(local, provider, blockNumber, blockers);
    realmCatalogue = await inspectRealmCatalogue(local, provider, blockNumber, blockers);
  }
  return {
    worldAddress: local.games.address,
    blockNumber,
    classes,
    deployedClassHash,
    realmCatalogue,
    releaseRegistered,
    submitterRotation,
    blockers,
    synced:
      blockers.length === 0 &&
      submitterRotation === undefined &&
      classes.every(({ declared }) => declared) &&
      deployedClassHash !== null &&
      releaseRegistered &&
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
  // The account class and guardian fix every player address, so the contract refuses changing them. The submitter
  // is the one rotatable part: a different one is a rotation for the authority to apply, not a blocker.
  const authentication = (await read("authentication")) as Record<keyof NativeWorld["authentication"], bigint>;
  if (
    authentication.account_class !== BigInt(local.authentication.account_class) ||
    authentication.guardian_public_key !== BigInt(local.authentication.guardian_public_key)
  )
    blockers.push("Games authentication mismatch: the account class and guardian are fixed");
  const configuration = (await read("deployment_configuration")) as {
    authority: bigint;
  };
  if (configuration.authority !== BigInt(local.authority)) blockers.push("Games authority mismatch");
  if (authentication.submitter === BigInt(local.authentication.submitter)) return undefined;
  return { from: `0x${authentication.submitter.toString(16)}`, to: local.authentication.submitter };
}

async function inspectRelease(
  local: NativeWorld,
  provider: RpcProvider,
  block: number,
  blockers: string[],
): Promise<boolean> {
  const current = await provider.callContract(
    { contractAddress: local.games.address, entrypoint: "current_release", calldata: [] },
    block,
  );
  const currentId = Number(BigInt(current[0]));
  if (local.release.releaseId < currentId) blockers.push("Cannot redeploy an older release over the current release");
  if (local.release.releaseId > currentId) {
    if (local.release.releaseId !== currentId + 1) blockers.push("Release must follow the current registered release");
    return false;
  }
  const raw = await provider.callContract(
    { contractAddress: local.games.address, entrypoint: "release", calldata: [String(local.release.releaseId)] },
    block,
  );
  const registered = new CallData(local.games.sierra.abi).parse("release", raw) as {
    classes: Record<string, bigint>;
    migration: bigint;
  };
  if (
    !local.logic.every(({ name, classHash }) => registered.classes[name] === BigInt(classHash)) ||
    registered.migration !== BigInt(local.release.migrationClassHash)
  )
    blockers.push("Release is immutable; registered contents differ from release facts");
  return blockers.length === 0;
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
