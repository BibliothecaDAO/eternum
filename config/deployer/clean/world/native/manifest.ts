import { hash, type Abi } from "starknet";
import type { NativeWorld, NativeWorldManifest, RegistrarWorld } from "./types";
import type { NativePlan } from "./types";
import type { ShardRecord } from "../../../../../apps/herald/src/shard-manifest";
import type { NativeSchema } from "../../../../../apps/herald/src/native/schema";

/** The shard's active schema: what its deployed Games contract exposes and how its rows are encoded. */
export function nativeWorldSchema(manifest: RegistrarWorld): NativeSchema {
  const schema = manifest.native?.schemas[manifest.native.activeSchema];
  if (!schema) throw new Error("Manifest has no active native schema");
  return schema;
}

export function nativeGamesAbi(manifest: RegistrarWorld): Abi {
  const schema = nativeWorldSchema(manifest);
  const games = schema.games;
  if (games?.contract !== "Games") throw new Error("Manifest has no Games ABI");
  return [...Object.values(schema.types), ...games.entrypoints] as Abi;
}

/** Resolve the Games surface from the shard's verified schema and address. */
export function registrarWorldOf(
  shard: { chainId: string; worldAddress: string },
  schema: NativeSchema,
): RegistrarWorld {
  return {
    native: { activeSchema: schema.identity, schemas: { [schema.identity]: schema } },
    world: { address: shard.worldAddress },
    shard: { chainId: shard.chainId },
  };
}

export function buildNativeManifest(local: NativeWorld, before: NativePlan, shard: ShardRecord): NativeWorldManifest {
  const games = local.games;
  const abis = new Map(
    [games, ...local.logic]
      .flatMap(({ sierra }) => sierra.abi)
      .filter((entry) => entry.type !== "impl")
      .map((entry) => [entry.name, entry]),
  );
  return {
    world: {
      address: games.address,
      class_hash: games.classHash,
      seed: local.seed,
      name: "Eternum Games",
      entrypoints: games.sierra.abi
        .flatMap((item) => (item.type === "interface" ? item.items : item.type === "function" ? [item] : []))
        .map((item) => item.name),
      abi: games.sierra.abi,
    },
    contracts: [
      {
        address: games.address,
        class_hash: games.classHash,
        selector: hash.getSelectorFromName("games"),
        init_calldata: games.constructorCalldata,
      },
    ],
    abis: [...abis.values()],
    shard,
    native: {
      version: 2,
      deploymentBlock: local.previous?.native.deploymentBlock ?? before.blockNumber,
      activeSchema: local.schema.identity,
      schemas: { ...local.previous?.native.schemas, [local.schema.identity]: local.schema },
      gamesClassHash: games.classHash,
      releaseId: local.release.releaseId,
      releaseSchemas: { ...local.previous?.native.releaseSchemas, [local.release.releaseId]: local.release.schema },
      logic: Object.fromEntries(local.logic.map(({ name, classHash }) => [name, classHash])),
    },
  };
}
