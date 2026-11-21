import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash, CallData } from "starknet";
import { schemaIdentity, type NativeSchema } from "../../../../../apps/herald/src/native/schema";
import { readClassArtifact } from "../../shared/declare";
import { nativeBalanceIdentity } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeIdentifiers } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { blitzPendingCommands } from "../../../../source/common/native-commands";
import { NATIVE_RELEASES } from "../../../../../deploy/release/native-release";
import type { NativeAuthentication, NativeReleaseFacts, NativeWorld, NativeWorldManifest } from "./types";

export function loadNativeWorld(input: {
  artifacts: string;
  schemaPath: string;
  seed: string;
  authority: string;
  launcher: string;
  ledgerOperator: string;
  vrfPublicKey: { x: string; y: string };
  l2GasBound: string;
  authentication: NativeAuthentication;
  release: NativeReleaseFacts;
  previous?: NativeWorldManifest;
}): NativeWorld {
  if (input.previous && input.previous.native?.version !== 2)
    throw new Error("Games requires a fresh deployment; the peer-contract manifest cannot be reused");
  if (input.previous && typeof input.previous.native.releases !== "object")
    throw new Error("The shard's manifest lists no releases with their families; deploy a fresh shard");
  // A manifest names the shard's one Games; another seed would deploy a second beside it and drop its history.
  if (input.previous && input.previous.world.seed !== input.seed)
    throw new Error(`The shard's Games was deployed with seed ${input.previous.world.seed}; ${input.seed} is refused`);
  const previous = input.previous;
  assertHotfixSchema(input.release, previous);
  assertBalanceSince(input.release, previous);
  const schema = JSON.parse(readFileSync(input.schemaPath, "utf8")) as NativeSchema;
  if (schemaIdentity(schema) !== schema.identity) throw new Error("Native schema identity mismatch");
  const readClass = (name: string) =>
    readClassArtifact(
      resolve(input.artifacts, `world_native_${name}.contract_class.json`),
      resolve(input.artifacts, `world_native_${name}.compiled_contract_class.json`),
    );
  const logic = schema.logicClasses.map(({ name, contract }) => ({ name, ...readClass(contract) }));
  const artifact = readClass("Games");
  const migration =
    BigInt(input.release.migrationClassHash) === 0n
      ? undefined
      : { name: "migration", ...readClass("ReleaseMigration") };
  if (migration && BigInt(migration.classHash) !== BigInt(input.release.migrationClassHash))
    throw new Error("Release migration facts do not match the compiled ReleaseMigration artifact");
  validateReleaseArtifacts(input.release, schema, artifact.classHash, logic, input.authentication.account_class);
  const verifier = {
    name: "verifier",
    ...readClassArtifact(
      resolve(input.artifacts, "../../../vrf-verifier/target/dev/realms_vrf_verifier_Verifier.contract_class.json"),
      resolve(
        input.artifacts,
        "../../../vrf-verifier/target/dev/realms_vrf_verifier_Verifier.compiled_contract_class.json",
      ),
    ),
  };
  if (BigInt(verifier.classHash) !== BigInt(input.release.classes.verifier))
    throw new Error("Verifier artifact differs from release pin");
  const constructorCalldata = new CallData(artifact.sierra.abi).compile("constructor", {
    owner: input.authority,
    launcher: input.launcher,
    vrf_public_key: input.vrfPublicKey,
    l2_gas_bound: input.l2GasBound,
    authentication: input.authentication,
    ...releaseRegistration(input.release, schema, 0),
  });
  const publishedSchema = previous?.native.releases[String(input.release.releaseId)]?.schema;
  if (publishedSchema && publishedSchema !== input.release.schema)
    throw new Error("Release schema is immutable; manifest and release facts differ");
  const salt = hash.starknetKeccak(`${input.seed}:games`).toString();
  const address =
    previous?.world.address ?? hash.calculateContractAddressFromHash(salt, artifact.classHash, constructorCalldata, 0);
  return {
    seed: input.seed,
    authority: input.authority,
    launcher: input.launcher,
    ledgerOperator: input.ledgerOperator,
    vrfPublicKey: input.vrfPublicKey,
    l2GasBound: input.l2GasBound,
    verifier,
    authentication: input.authentication,
    schema,
    games: { ...artifact, address, salt, constructorCalldata },
    logic,
    migration,
    release: input.release,
    previous,
  };
}

export function releaseRegistration(release: NativeReleaseFacts, schema: NativeSchema, previous: number) {
  const family = NATIVE_RELEASES.frontier.family;
  assertFamilyLogicReturned(family);
  return {
    release_id: release.releaseId,
    release: {
      family,
      previous,
      slot_count: schema.logicClasses.length,
      migration: release.migrationClassHash,
    },
    classes: schema.logicClasses.map(({ name }) => release.classes.logic[name]),
  };
}

export function assertFamilyLogicReturned(family: number): void {
  if (family === nativeIdentifiers.family.BLITZ && blitzPendingCommands.length > 0)
    throw new Error(`NATIVE_BLITZ_PENDING: the Blitz logic has not returned for ${blitzPendingCommands.join(", ")}`);
}

function validateReleaseArtifacts(
  release: NativeReleaseFacts,
  schema: NativeSchema,
  games: string,
  logic: Array<{ name: string; classHash: string }>,
  account: string,
): void {
  if (!Number.isSafeInteger(release.releaseId) || release.releaseId < 1 || release.releaseId > 0xffffffff)
    throw new Error("Invalid native release id");
  if (!/^0x[0-9a-f]+$/i.test(release.migrationClassHash)) throw new Error("Invalid release migration class hash");
  if (
    release.schema !== schema.identity ||
    BigInt(release.classes.games) !== BigInt(games) ||
    BigInt(release.classes.account) !== BigInt(account) ||
    Object.keys(release.classes.logic).length !== logic.length ||
    !logic.every(({ name, classHash }) => BigInt(release.classes.logic[name] ?? -1) === BigInt(classHash))
  )
    throw new Error("Release facts do not match the compiled artifacts");
}

export function assertHotfixSchema(release: NativeReleaseFacts, previous?: NativeWorldManifest): void {
  if (previous && release.schema !== previous.native.activeSchema)
    throw new Error(
      "NATIVE_HOTFIX_SCHEMA_CHANGE: a hotfix must keep the shard fact schema; create a new shard or season",
    );
}

export function assertBalanceSince(release: NativeReleaseFacts, previous?: NativeWorldManifest): void {
  const changed = Object.entries(previous?.native.releaseBalances ?? {}).find(
    ([id, numbers]) =>
      Number(id) >= NATIVE_RELEASES.frontier.since &&
      Number(id) < release.releaseId &&
      numbers !== nativeBalanceIdentity,
  );
  if (changed)
    throw new Error(
      `NATIVE_BALANCE_SINCE: release ${changed[0]} runs other balance numbers; set NATIVE_RELEASES.frontier.since to ${release.releaseId}`,
    );
}
