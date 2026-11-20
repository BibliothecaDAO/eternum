/**
 * The facts a release deploys, read from this checkout's compiled contracts: the class of every contract a shard's
 * initialization deploys, the release id and the active schema. The init image bakes them at build; the box records
 * them in release.json with its commit and images; the deploy command compares a deployed shard against them.
 *
 *   bun deploy/release/facts.ts > release-facts.json
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readClassArtifact } from "../../config/deployer/clean/shared/declare";
import { schemaIdentity, type NativeSchema } from "../../apps/herald/src/native/schema";
import { NATIVE_RELEASE_ID } from "./native-release";

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
  return {
    releaseId: NATIVE_RELEASE_ID,
    migrationClassHash: "0x0",
    schema: schema.identity,
    classes: {
      games: worldClass("Games"),
      logic: Object.fromEntries(
        Object.entries(schema.logicClasses).map(([name, contract]) => [name, worldClass(contract)]),
      ),
      account: classHash(ACCOUNT),
      verifier: classHash(resolve(ROOT, "contracts/l3/vrf-verifier/target/dev/realms_vrf_verifier_Verifier")),
    },
  };
}

console.log(JSON.stringify(releaseFacts(), null, 2));
