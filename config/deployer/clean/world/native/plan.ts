import { assertBalanceSince, assertHotfixSchema } from "./artifacts";
import { CallData, type RpcProvider } from "starknet";
import type { NativeReleases } from "@bibliothecadao/eternum/game-sync";
import { deployedClass, isClassDeclared } from "../../shared/declare";
import { canonicalRealmTraits, realmCatalogueDigest } from "./realm-catalogue";
import type { NativePlan, NativeWorld } from "./types";
import { NATIVE_RELEASES } from "../../../../../deploy/release/native-release";

export async function inspectNativeWorld(local: NativeWorld, provider: RpcProvider): Promise<NativePlan> {
  assertHotfixSchema(local.release, local.previous);
  assertBalanceSince(local.release, local.previous);
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
  let releases: NativeReleases = {};
  let roleChanges: NativePlan["roleChanges"] = [];
  if (deployedClassHash && blockers.length === 0) {
    roleChanges = await inspectGamesConfiguration(local, provider, blockNumber, blockers);
    releaseRegistered = await inspectRelease(local, provider, blockNumber, blockers);
    realmCatalogue = await inspectRealmCatalogue(local, provider, blockNumber, blockers);
    if (releaseRegistered) releases = await readUnpublishedLine(local, provider, blockNumber);
  }
  return {
    worldAddress: local.games.address,
    blockNumber,
    classes,
    deployedClassHash,
    realmCatalogue,
    releaseRegistered,
    releases,
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
  // The constructor installs launcher; redeployment must preserve handed-off service roles.
  if (ledger[0] === 0n) changes.push({ entrypoint: "set_ledger_operator", address: local.ledgerOperator });
  return changes;
}

async function inspectRelease(
  local: NativeWorld,
  provider: RpcProvider,
  block: number,
  blockers: string[],
): Promise<boolean> {
  const isRegistered = async (releaseId: number) =>
    BigInt(
      (
        await provider.callContract(
          { contractAddress: local.games.address, entrypoint: "release_registered", calldata: [String(releaseId)] },
          block,
        )
      )[0]!,
    ) === 1n;
  const releaseId = local.release.releaseId;
  if (await isRegistered(releaseId + 1))
    blockers.push("Cannot redeploy an older release over a newer registered release");
  if (!(await isRegistered(releaseId))) {
    if (!(await isRegistered(releaseId - 1))) blockers.push("Release must follow the latest registered release");
    return false;
  }
  const codec = new CallData(local.games.sierra.abi);
  const view = async (entrypoint: string) =>
    codec.parse(
      entrypoint,
      await provider.callContract(
        { contractAddress: local.games.address, entrypoint, calldata: [String(local.release.releaseId)] },
        block,
      ),
    );
  const registered = (await view("release")) as { family: bigint; migration: bigint };
  const classes = (await view("release_classes")) as bigint[];
  if (
    registered.family !== BigInt(NATIVE_RELEASES.frontier.family) ||
    classes.length !== local.logic.length ||
    !local.logic.every(({ classHash }, slot) => classes[slot] === BigInt(classHash)) ||
    registered.migration !== BigInt(local.release.migrationClassHash)
  )
    blockers.push("Release is immutable; registered contents differ from release facts");
  return blockers.length === 0;
}

async function readUnpublishedLine(local: NativeWorld, provider: RpcProvider, block: number) {
  const published = local.previous?.native.releases ?? {};
  const codec = new CallData(local.games.sierra.abi);
  const line: Record<string, { schema: string; family: number; previous: number }> = {};
  for (let id = local.release.releaseId; id !== 0 && !(String(id) in published); ) {
    const raw = await provider.callContract(
      { contractAddress: local.games.address, entrypoint: "release", calldata: [String(id)] },
      block,
    );
    const { family, previous } = codec.parse("release", raw) as { family: bigint; previous: bigint };
    line[String(id)] = { schema: local.release.schema, family: Number(family), previous: Number(previous) };
    id = Number(previous);
  }
  return line;
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
