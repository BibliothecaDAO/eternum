import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { RPCProvider, Query } from "@dojoengine/core";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {
  const provider = new RPCProvider(import.meta.env.VITE_WORLD_ADDRESS!, import.meta.env.VITE_KATANA_URL);

  return {
    contractComponents: defineContractComponents(world),
    provider,
    entity: async (component: string, query: Query) => provider.entity(component, query),
    entities: async (component: string, partition: number) => provider.entities(component, partition),
    world,
  };
}
