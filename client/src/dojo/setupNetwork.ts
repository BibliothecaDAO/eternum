import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { EternumProvider } from "@bibliothecadao/eternum";
import { Query } from "@dojoengine/core";
import dev_manifest from "../../../contracts/target/dev/manifest.json";
import prod_manifest from "../../../contracts/target/release/manifest.json";
import * as torii from "@dojoengine/torii-client";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {
  const { VITE_PUBLIC_WORLD_ADDRESS, VITE_PUBLIC_KATANA_URL, VITE_PUBLIC_TORII } = import.meta.env;

  const manifest = import.meta.env.VITE_DEV === "true" ? dev_manifest : prod_manifest;

  const provider = new EternumProvider(
    import.meta.env.VITE_PUBLIC_WORLD_ADDRESS!,
    import.meta.env.VITE_PUBLIC_KATANA_URL,
    manifest,
  );

  console.log(VITE_PUBLIC_WORLD_ADDRESS, VITE_PUBLIC_KATANA_URL, VITE_PUBLIC_TORII);

  // grpc
  const toriiClient = await torii.createClient([], {
    rpcUrl: VITE_PUBLIC_KATANA_URL,
    toriiUrl: VITE_PUBLIC_TORII,
    worldAddress: VITE_PUBLIC_WORLD_ADDRESS,
  });

  return {
    contractComponents: defineContractComponents(world),
    toriiClient,
    provider,
    entity: async (component: string, query: Query) => provider.entity(component, query),
    entities: async (component: string, partition: number) => provider.entities(component, partition),
    world,
  };
}
