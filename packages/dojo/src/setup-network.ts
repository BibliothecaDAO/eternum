import { world } from "@bibliothecadao/types";
import type { DojoConfig } from "@dojoengine/core";

import { EternumProvider } from "@bibliothecadao/provider";
import { defineContractComponents } from "@bibliothecadao/types";
import type { ResourceBoundsBN } from "starknet";

// Define an explicit interface for the return type
interface SetupNetworkExplicitReturn {
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

export type DojoSetupConfig = Pick<DojoConfig, "manifest" | "rpcUrl">;

export async function setupNetwork(
  config: DojoSetupConfig,
  env: SetupNetworkEnvironment,
): Promise<SetupNetworkExplicitReturn> {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, env.vrfProviderAddress, undefined, {
    executionResourceBounds: env.executionResourceBounds,
    namespace: env.namespace,
    gameId: env.gameId,
  });

  return {
    contractComponents: defineContractComponents(world, env.namespace ?? "s1_eternum"),
    provider,
    world,
  };
}
