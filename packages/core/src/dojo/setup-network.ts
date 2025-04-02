import { DojoConfig } from "@dojoengine/core";
import { world } from "./world";

import * as torii from "@dojoengine/torii-client";
import { defineContractComponents } from "..";
import { EternumProvider } from "../provider";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork(
  config: DojoConfig,
  env: {
    vrfProviderAddress: string;
    useBurner: boolean;
  },
) {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, env.vrfProviderAddress);

  const toriiClient = await torii.createClient({
    toriiUrl: config.toriiUrl,
    relayUrl: config.relayUrl,
    worldAddress: config.manifest.world.address || "",
  });



  return {
    toriiClient,
    contractComponents: defineContractComponents(world),
    provider,
    world,
  };
}
