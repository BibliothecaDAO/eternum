import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities } from "@dojoengine/state";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { createUpdates } from "./createUpdates";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const updates = await createUpdates();

  // fetch all existing entities from torii
  const sync = await getSyncEntities(
    network.toriiClient,
    network.contractComponents as any,
    [
      {
        Keys: {
          keys: [],
          pattern_matching: "VariableLen",
          models: [],
        },
      },
    ],
    1000,
  );

  return {
    network,
    components,
    systemCalls,
    updates,
    sync,
  };
}
