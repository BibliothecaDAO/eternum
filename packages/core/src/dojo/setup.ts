import { DojoConfig } from "@dojoengine/core";
import { createSystemCalls } from "./create-system-calls";
import { createClientComponents } from "./createClientComponents";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup(config: DojoConfig, env: { viteVrfProviderAddress: string; vitePublicDev: boolean }) {
  const network = await setupNetwork(config, env);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  return {
    network,
    components,
    systemCalls,
    // sync,
    // eventSync,
  };
}
