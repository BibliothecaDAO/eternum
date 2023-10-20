import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { EternumProvider } from "@bibliothecadao/eternum";
import { Query } from "@dojoengine/core";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {
  const provider = new EternumProvider(
    import.meta.env.VITE_WORLD_ADDRESS!,
    import.meta.env.DEV,
    import.meta.env.VITE_KATANA_URL,
  );

  const world_address = provider.getWorldAddress();
  console.log({ world_address });
  const uuid = await provider.uuid();
  console.log({ uuid });

  return {
    contractComponents: defineContractComponents(world),
    provider,
    entity: async (component: string, query: Query) => provider.entity(component, query),
    entities: async (component: string, partition: number) => provider.entities(component, partition),
    world,
  };
}
