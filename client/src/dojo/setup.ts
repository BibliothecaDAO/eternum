import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { setupNetwork } from "./setupNetwork";
import { createUpdates } from "./createUpdates";
import { getSyncEntities } from "@dojoengine/state";
import { DojoConfig } from "@dojoengine/core";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const updates = await createUpdates();

  // fetch all existing entities from torii
  await getSyncEntities(network.toriiClient, network.contractComponents as any, 1000);

  return {
    network,
    components,
    systemCalls,
    updates,
  };
}
