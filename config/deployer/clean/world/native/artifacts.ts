import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash, CallData } from "starknet";
import { schemaIdentity, type NativeSchema } from "../../../../../apps/herald/src/native/schema";
import { readClassArtifact } from "../../shared/declare";
import type { NativeAuthentication, NativeReleaseFacts, NativeWorld, NativeWorldManifest } from "./types";

export function loadNativeWorld(input: {
  artifacts: string;
  schemaPath: string;
  seed: string;
  authority: string;
  authentication: NativeAuthentication;
  release: NativeReleaseFacts;
  previous?: NativeWorldManifest;
}): NativeWorld {
  if (input.previous && input.previous.native?.version !== 2)
    throw new Error("Games requires a fresh deployment; the peer-contract manifest cannot be reused");
  const previous = input.previous?.world.seed === input.seed ? input.previous : undefined;
  assertHotfixSchema(input.release, previous);
  const schema = JSON.parse(readFileSync(input.schemaPath, "utf8")) as NativeSchema;
  if (schemaIdentity(schema) !== schema.identity) throw new Error("Native schema identity mismatch");
  const readClass = (name: string) =>
    readClassArtifact(
      resolve(input.artifacts, `world_native_${name}.contract_class.json`),
      resolve(input.artifacts, `world_native_${name}.compiled_contract_class.json`),
    );
  const logic = Object.entries(schema.logicClasses).map(([name, contract]) => ({ name, ...readClass(contract) }));
  const artifact = readClass("Games");
  const migration =
    BigInt(input.release.migrationClassHash) === 0n
      ? undefined
      : { name: "migration", ...readClass("ReleaseMigration") };
  if (migration && BigInt(migration.classHash) !== BigInt(input.release.migrationClassHash))
    throw new Error("Release migration facts do not match the compiled ReleaseMigration artifact");
  validateReleaseArtifacts(input.release, schema, artifact.classHash, logic, input.authentication.account_class);
  const constructorCalldata = new CallData(artifact.sierra.abi).compile("constructor", {
    authority: input.authority,
    authentication: input.authentication,
    release_id: input.release.releaseId,
    release: { classes: input.release.classes.logic, migration: input.release.migrationClassHash },
  });
  const publishedSchema = previous?.native.releaseSchemas[String(input.release.releaseId)];
  if (publishedSchema && publishedSchema !== input.release.schema)
    throw new Error("Release schema is immutable; manifest and release facts differ");
  const salt = hash.starknetKeccak(`${input.seed}:games`).toString();
  const address =
    previous?.world.address ?? hash.calculateContractAddressFromHash(salt, artifact.classHash, constructorCalldata, 0);
  return {
    seed: input.seed,
    authority: input.authority,
    authentication: input.authentication,
    schema,
    games: { ...artifact, address, salt, constructorCalldata },
    logic,
    migration,
    release: input.release,
    previous,
  };
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
