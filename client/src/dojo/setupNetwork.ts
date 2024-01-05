import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { EternumProvider } from "@bibliothecadao/eternum";
import dev_manifest from "../../../contracts/target/dev/manifest.json";
import prod_manifest from "../../../contracts/target/release/manifest.json";
import * as torii from "@dojoengine/torii-client";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {
  const { VITE_PUBLIC_WORLD_ADDRESS, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_TORII } = import.meta.env;

  const manifest = import.meta.env.VITE_DEV === "true" ? dev_manifest : prod_manifest;

  const provider = new EternumProvider(VITE_PUBLIC_WORLD_ADDRESS, VITE_PUBLIC_NODE_URL, manifest);

  const toriiClient = await torii.createClient([], {
    rpcUrl: VITE_PUBLIC_NODE_URL,
    toriiUrl: VITE_PUBLIC_TORII,
    worldAddress: VITE_PUBLIC_WORLD_ADDRESS,
  });

  return {
    toriiClient,
    contractComponents: defineContractComponents(world),
    provider,
    world,
  };
}
