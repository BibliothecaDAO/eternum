import { world } from "@bibliothecadao/types";
import { DojoConfig } from "@dojoengine/core";

import { createClient } from "@dojoengine/sdk";

import { EternumProvider } from "@bibliothecadao/provider";
import { defineContractComponents } from "@bibliothecadao/types";
import type { ResourceBoundsBN } from "starknet";

// Define an explicit interface for the return type
interface SetupNetworkExplicitReturn {
  toriiClient: Awaited<ReturnType<typeof createClient>>;
  contractComponents: ReturnType<typeof defineContractComponents>;
  provider: EternumProvider;
  world: typeof world;
}

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export interface SetupNetworkEnvironment {
  executionResourceBounds?: ResourceBoundsBN;
  gameId?: number;
  /** Model namespace: "s2" on appchain worlds, "s1_eternum" on legacy worlds. */
  namespace?: string;
  useBurner: boolean;
  vrfProviderAddress: string;
}

export async function setupNetwork(
  config: DojoConfig,
  env: SetupNetworkEnvironment,
): Promise<SetupNetworkExplicitReturn> {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, env.vrfProviderAddress, undefined, {
    executionResourceBounds: env.executionResourceBounds,
    namespace: env.namespace,
    gameId: env.gameId,
  });

  const toriiClient = await createClient({
    worldAddress: config.manifest.world.address || "",
    // relayUrl: config.relayUrl,
    toriiUrl: config.toriiUrl,
  });

  return {
    toriiClient,
    contractComponents: defineContractComponents(world, env.namespace ?? "s1_eternum"),
    provider,
    world,
  };
}
