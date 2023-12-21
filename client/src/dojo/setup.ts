import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { createOptimisticSystemCalls } from "./createOptimisticSystemCalls";
import { setupNetwork } from "./setupNetwork";
import { createUpdates } from "./createUpdates";
import { getSyncEntities } from "@dojoengine/react";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup() {
  const network = await setupNetwork();
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const optimisticSystemCalls = createOptimisticSystemCalls(components);
  const updates = await createUpdates(components);

  // fetch all existing entities from torii
  await getSyncEntities(network.toriiClient, network.contractComponents as any);

  return {
    network,
    components,
    systemCalls,
    optimisticSystemCalls,
    updates,
  };
}
