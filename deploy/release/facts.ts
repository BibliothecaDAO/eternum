/**
 * The facts a release deploys, read from this checkout's compiled contracts: the class of every contract a shard's
 * initialization deploys, the release id, the active schema, and the commitment of every preset the release can
 * register. The init image bakes them at build; CI publishes them as release.json beside the shard package; the
 * deploy command compares a deployed shard against them.
 *
 *   bun deploy/release/facts.ts > release-facts.json
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativePresets } from "../../config/source/native";
import { buildNativePreset } from "../../config/deployer/clean/config/native-preset";
import { isDeploymentEnvironmentId } from "../../config/deployer/clean/environment";
import { loadNativePresetConfiguration, presetRegistrationCall } from "../../config/deployer/clean/registrar/native-preset";
import { readClassArtifact } from "../../config/deployer/clean/shared/declare";
import { NATIVE_RELEASE_ID, registrarWorldOf } from "../../config/deployer/clean/world/native/manifest";
import { schemaIdentity, type NativeSchema } from "../../apps/herald/src/native/schema";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORLD = resolve(ROOT, "contracts/l3/world-native");
const ACCOUNT = resolve(ROOT, "contracts/l3/player-account/target/dev/realms_player_account_RealmsAccount");

function classHash(base: string): string {
  return readClassArtifact(`${base}.contract_class.json`, `${base}.compiled_contract_class.json`).classHash;
}

function releaseFacts() {
  const schema = JSON.parse(readFileSync(resolve(WORLD, "schema/schema.json"), "utf8")) as NativeSchema;
  if (schemaIdentity(schema) !== schema.identity) throw new Error("Native schema identity mismatch");
  const worldClass = (contract: string) => classHash(resolve(WORLD, `target/dev/world_native_${contract}`));
  // A commitment covers the register_preset calldata only, so any Games address encodes it the same way.
  const registrar = registrarWorldOf({ chainId: "0x0", worldAddress: "0x0" }, schema);
  // A preset whose mode has no deployment environment (Duel) cannot be registered by this release.
  const presets = Object.values(nativePresets).flatMap(({ id, gameType }) => {
    const environment = `madara.${gameType}`;
    if (!isDeploymentEnvironmentId(environment)) return [];
    const definition = buildNativePreset(loadNativePresetConfiguration(environment, id), id);
    return [[String(id), presetRegistrationCall(definition, id, registrar).commitment]];
  });
  return {
    releaseId: NATIVE_RELEASE_ID,
    schema: schema.identity,
    classes: {
      games: worldClass("Games"),
      logic: Object.fromEntries(Object.entries(schema.logicClasses).map(([name, contract]) => [name, worldClass(contract)])),
      account: classHash(ACCOUNT),
    },
    presets: Object.fromEntries(presets),
  };
}

console.log(JSON.stringify(releaseFacts(), null, 2));
