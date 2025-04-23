import { DojoConfig } from "@dojoengine/core";
import { world } from "@bibliothecadao/types";

import * as torii from "@dojoengine/torii-client";

import { defineContractComponents } from "@bibliothecadao/types";
import { EternumProvider } from "@bibliothecadao/provider";

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
