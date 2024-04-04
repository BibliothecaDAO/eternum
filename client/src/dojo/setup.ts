import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { createOptimisticSystemCalls } from "./createOptimisticSystemCalls";
import { setupNetwork } from "./setupNetwork";
import { createUpdates } from "./createUpdates";
import { getSyncEntities } from "@dojoengine/state";
import { DojoConfig } from "@dojoengine/core";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const optimisticSystemCalls = createOptimisticSystemCalls(components);
  const updates = await createUpdates();

  // fetch all existing entities from torii
  await getSyncEntities(network.toriiClient, network.contractComponents as any, 5000);

  return {
    network,
    components,
    systemCalls,
    optimisticSystemCalls,
    updates,
  };
}
