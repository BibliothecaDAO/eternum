import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities, getSyncEvents } from "@dojoengine/state";
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

  // fetch all existing entities from torii
  const sync = await getSyncEntities(network.toriiClient, network.contractComponents as any, [], 1000);

  const eventSync = getSyncEvents(network.toriiClient, network.contractComponents.events as any, undefined, []);

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
