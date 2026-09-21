import { hash, type Abi } from "starknet";
import type { NativeWorld, NativeWorldManifest } from "./types";
import type { NativePlan } from "./types";

export function nativeDomainAbi(manifest: NativeWorldManifest, name: string): Abi {
  const schema = manifest.native?.schemas[manifest.native.activeSchema];
  const domain = schema?.domains[name];
  if (!domain) throw new Error(`Manifest has no native ${name} ABI`);
  // Domain entrypoint names can overlap (for example season and registry create_game).
  return [...Object.values(schema.types), ...domain.entrypoints] as Abi;
}

export function buildNativeManifest(local: NativeWorld, before: NativePlan): NativeWorldManifest {
  const season = local.domains.find((domain) => domain.name === "season")!;
  const abis = new Map(
    local.domains
      .flatMap((domain) => domain.sierra.abi)
      .filter((entry) => entry.type !== "impl")
      .map((entry) => [entry.name, entry]),
  );
  return {
    world: {
      address: season.address,
      class_hash: season.classHash,
      seed: local.seed,
      name: "Eternum native",
      entrypoints: local.schema.domains.season.entrypoints.map((entry) => entry.name),
      abi: season.sierra.abi,
    },
    contracts: local.domains.map((domain) => ({
      address: domain.address,
      class_hash: domain.classHash,
      selector: hash.getSelectorFromName(domain.name),
      init_calldata: domain.constructorCalldata,
    })),
    events: [],
    abis: [...abis.values()],
    native: {
      version: 1,
      deploymentBlock: local.previous?.native.deploymentBlock ?? before.blockNumber,
      activeSchema: local.schema.identity,
      schemas: { ...local.previous?.native.schemas, [local.schema.identity]: local.schema },
      domains: Object.fromEntries(
        local.domains.map((domain) => {
          const previous = local.previous?.native.domains[domain.name];
          return [
            domain.name,
            {
              address: domain.address,
              initialClassHash: previous?.initialClassHash ?? domain.classHash,
              classes: { ...previous?.classes, [domain.classHash]: local.schema.identity },
            },
          ];
        }),
      ),
    },
  };
}
