import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { createOptimisticSystemCalls } from "./createOptimisticSystemCalls";
import { setupNetwork } from "./setupNetwork";
import { createUpdates } from "./createUpdates";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup() {
  const network = await setupNetwork();
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const optimisticSystemCalls = createOptimisticSystemCalls(components);
  const updates = await createUpdates(components);
  return {
    network,
    components,
    systemCalls,
    optimisticSystemCalls,
    updates,
  };
}
