import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { DojoConfig } from "@dojoengine/core";
import { EternumProvider } from "@bibliothecadao/eternum";
import katana from "../../../contracts/manifests/deployments/KATANA.json";
import * as torii from "@dojoengine/torii-client";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork({ ...config }: DojoConfig) {
  const provider = new EternumProvider(katana, config.rpcUrl);

  const toriiClient = await torii.createClient([], {
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    relayUrl: "",
    worldAddress: config.manifest.world.address || "",
  });

  return {
    toriiClient,
    contractComponents: defineContractComponents(world),
    provider,
    world,
  };
}
