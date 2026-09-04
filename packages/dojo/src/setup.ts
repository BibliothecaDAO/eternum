import {
  ClientComponents,
  createClientComponents,
  createSystemCalls,
  SystemCallAuthHandler,
  SystemCalls,
} from "@bibliothecadao/types";
import { setupNetwork, SetupNetworkResult, type DojoSetupConfig, type SetupNetworkEnvironment } from "./setup-network";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export interface SetupReturnValue {
  network: SetupNetworkResult;
  components: ClientComponents;
  systemCalls: SystemCalls;
}

export async function setup(
  config: DojoSetupConfig,
  env: SetupNetworkEnvironment,
  authHandler?: SystemCallAuthHandler,
): Promise<SetupReturnValue> {
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
