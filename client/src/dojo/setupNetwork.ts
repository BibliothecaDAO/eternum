import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { EternumProvider } from "@bibliothecadao/eternum";
import { Query } from "@dojoengine/core";
import dev_manifest from "../../../contracts/target/dev/manifest.json";
import prod_manifest from "../../../contracts/target/release/manifest.json";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {
  const manifest = import.meta.env.VITE_DEV === "true" ? dev_manifest : prod_manifest;

  const provider = new EternumProvider(import.meta.env.VITE_WORLD_ADDRESS!, import.meta.env.VITE_KATANA_URL, manifest);

  return {
    contractComponents: defineContractComponents(world),
    provider,
    entity: async (component: string, query: Query) => provider.entity(component, query),
    entities: async (component: string, partition: number) => provider.entities(component, partition),
    world,
  };
}
