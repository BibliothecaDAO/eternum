import { DojoConfig } from "@dojoengine/core";

import { createClientComponents, createSystemCalls, SystemCallAuthHandler } from "@bibliothecadao/types";
import { setupNetwork } from "./setup-network";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup(
  config: DojoConfig,
  env: { vrfProviderAddress: string; useBurner: boolean },
  authHandler?: SystemCallAuthHandler,
) {
  const network = await setupNetwork(config, env);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls({
    provider: network.provider,
    authHandler,
  });

  return {
    network,
    components,
    systemCalls,
  };
}
