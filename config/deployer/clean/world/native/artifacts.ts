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
  if (input.previous && !input.previous.native)
    throw new Error("Cannot replace a non-native world with native domains");
  const schema = JSON.parse(readFileSync(input.schemaPath, "utf8")) as NativeSchema;
  if (schemaIdentity(schema) !== schema.identity) throw new Error("Native schema identity mismatch");
  const previous = input.previous?.world.seed === input.seed ? input.previous : undefined;
  const domains = Object.entries(schema.domains).map(([name, definition]) => {
    const artifact = readClassArtifact(
      resolve(input.artifacts, `world_native_${definition.contract}.contract_class.json`),
      resolve(input.artifacts, `world_native_${definition.contract}.compiled_contract_class.json`),
    );
    const entrypoints = artifact.sierra.abi
      .filter((entry) => entry.type === "interface")
      .flatMap((entry) => entry.items);
    if (JSON.stringify(entrypoints) !== JSON.stringify(definition.entrypoints))
      throw new Error(`Native schema does not match ${name} ABI; regenerate it before deployment`);
    const constructorCalldata = new CallData(artifact.sierra.abi).compile("constructor", {
      authority: input.authority,
      ...(name === "season" ? { authentication: input.authentication } : {}),
    });
    const salt = hash.starknetKeccak(`${input.seed}:${name}`).toString();
    const address =
      previous?.native.domains[name]?.address ??
      hash.calculateContractAddressFromHash(salt, artifact.classHash, constructorCalldata, 0);
    return { ...artifact, name, address, salt, constructorCalldata };
  });
  return {
    seed: input.seed,
    authority: input.authority,
    authentication: input.authentication,
    schema,
    domains,
    previous,
  };
}

export const nativePeers = (local: NativeWorld): Record<string, string> =>
  Object.fromEntries(local.domains.map((domain) => [domain.name, domain.address]));
