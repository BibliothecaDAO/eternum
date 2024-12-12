import { WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities, syncEntities } from "@dojoengine/state";
import { Clause } from "@dojoengine/torii-client";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { ClientConfigManager } from "./modelManager/ConfigManager";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  const clauses: Clause[] = [
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString()],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
  ];

  // fetch all existing entities from torii
  const sync = await getSyncEntities(
    network.toriiClient,
    network.contractComponents as any,
    { Composite: { operator: "Or", clauses } },
    [],
    40000,
    true,
  );

  syncEntities(network.toriiClient, network.contractComponents as any, []);
  const syncObject = {
    sync,
    clauses: [...clauses],
  };

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    syncObject,
    sync,
    // eventSync,
  };
}
