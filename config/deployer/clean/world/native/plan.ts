import { assertHotfixSchema } from "./artifacts";
import { CallData, type RpcProvider } from "starknet";
import { deployedClass, isClassDeclared } from "../../shared/declare";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import type { NativePlan, NativeWorld } from "./types";

export async function inspectNativeWorld(local: NativeWorld, provider: RpcProvider): Promise<NativePlan> {
  assertHotfixSchema(local.release, local.previous);
  const blockNumber = await provider.getBlockNumber();
  const blockers: string[] = [];
  const classes = await Promise.all(
    [
      local.verifier,
      ...local.logic,
      ...(local.migration ? [local.migration] : []),
      { name: "games", ...local.games },
    ].map(async ({ name, classHash }) => ({
      name,
      classHash,
      declared: await isClassDeclared(provider, classHash, blockNumber),
    })),
  );
  const deployedClassHash = await deployedClass(provider, local.games.address, blockNumber);
  if (deployedClassHash && BigInt(deployedClassHash) !== BigInt(local.games.classHash))
    blockers.push("Games is immutable; the deployed class differs from this release");
  let realmCatalogue: NativePlan["realmCatalogue"];
  let releaseRegistered = false;
  let roleChanges: NativePlan["roleChanges"] = [];
  if (deployedClassHash && blockers.length === 0) {
    roleChanges = await inspectGamesConfiguration(local, provider, blockNumber, blockers);
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
    roleChanges,
    blockers,
    synced:
      blockers.length === 0 &&
      roleChanges.length === 0 &&
      classes.every(({ declared }) => declared) &&
      deployedClassHash !== null &&
      releaseRegistered &&
      realmCatalogue?.initialized === canonicalRealmTraits.length,
  };
}

async function inspectGamesConfiguration(local: NativeWorld, provider: RpcProvider, block: number, blockers: string[]) {
  const raw = async (entrypoint: string) =>
    (await provider.callContract({ contractAddress: local.games.address, entrypoint, calldata: [] }, block)).map(
      BigInt,
    );
  const [authentication, owner, launcher, ledger, key, bound] = await Promise.all([
    raw("authentication"),
    raw("owner"),
    raw("launcher"),
    raw("ledger_operator"),
    raw("vrf_public_key"),
    raw("l2_gas_bound"),
  ]);
  if (
    authentication.length !== 2 ||
    authentication[0] !== BigInt(local.authentication.account_class) ||
    authentication[1] !== BigInt(local.authentication.guardian_public_key)
  )
    blockers.push("Games authentication mismatch: the account class and guardian are fixed");
  if (owner.length !== 1 || owner[0] !== BigInt(local.authority)) blockers.push("Games authority mismatch");
  if (key.length !== 2 || key[0] !== BigInt(local.vrfPublicKey.x) || key[1] !== BigInt(local.vrfPublicKey.y))
    blockers.push("Games VRF key is immutable; retire this shard");
  if (bound.length !== 1 || bound[0] !== BigInt(local.l2GasBound)) blockers.push("Games play gas bound is immutable");
  const changes: NonNullable<NativePlan["roleChanges"]> = [];
  if (launcher.length !== 1 || ledger.length !== 1) throw new Error("Invalid Games role read");
  if (launcher[0] !== BigInt(local.launcher)) changes.push({ entrypoint: "set_launcher", address: local.launcher });
  if (ledger[0] !== BigInt(local.ledgerOperator))
    changes.push({ entrypoint: "set_ledger_operator", address: local.ledgerOperator });
  return changes;
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
