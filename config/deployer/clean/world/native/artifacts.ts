import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash, CallData } from "starknet";
import { schemaIdentity, type NativeSchema } from "../../../../../apps/herald/src/native/schema";
import { readClassArtifact } from "../../shared/declare";
import type { NativeAuthentication, NativeWorld, NativeWorldManifest } from "./types";

export function loadNativeWorld(input: {
  artifacts: string;
  schemaPath: string;
  seed: string;
  authority: string;
  authentication: NativeAuthentication;
  previous?: NativeWorldManifest;
}): NativeWorld {
  if (input.previous && input.previous.native?.version !== 2)
    throw new Error("Games requires a fresh deployment; the peer-contract manifest cannot be reused");
  const schema = JSON.parse(readFileSync(input.schemaPath, "utf8")) as NativeSchema;
  if (schemaIdentity(schema) !== schema.identity) throw new Error("Native schema identity mismatch");
  const readClass = (name: string) =>
    readClassArtifact(
      resolve(input.artifacts, `world_native_${name}.contract_class.json`),
      resolve(input.artifacts, `world_native_${name}.compiled_contract_class.json`),
    );
  const logic = Object.entries(schema.logicClasses).map(([name, contract]) => ({ name, ...readClass(contract) }));
  const artifact = readClass("Games");
  const constructorCalldata = new CallData(artifact.sierra.abi).compile("constructor", {
    authority: input.authority,
    authentication: input.authentication,
    classes: Object.fromEntries(logic.map(({ name, classHash }) => [name, classHash])),
  });
  const previous = input.previous?.world.seed === input.seed ? input.previous : undefined;
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
    previous,
  };
}
