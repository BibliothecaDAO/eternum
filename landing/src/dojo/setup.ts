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

  // Helper function to filter components or events for syncing
  const getFilteredComponents = (componentKeys: (keyof typeof network.contractComponents)[]) => {
    return componentKeys.map((key) => network.contractComponents[key]);
  };

  const getFilteredEvents = (eventKeys: (keyof (typeof network.contractComponents)["events"])[]) => {
    return eventKeys.map((key) => network.contractComponents["events"][key]);
  };

  const filteredComponents = getFilteredComponents([
    "AddressName",
    "Realm",
    "Owner",
    // points
    "Hyperstructure",
    "Epoch",
    "Season",
    "Contribution",
    "HyperstructureResourceConfig",
    "HyperstructureConfig",
    "TickConfig",
    // leaderboard
    "GuildMember",
    "EntityName",
    "Structure",
    // todo: these are needed only for the bridge: how to improve this?
    "Position",
    "WeightConfig",
    "CapacityConfig",
    "EntityOwner",
    "ArrivalTime",
    "OwnedResourcesTracker",
    "Weight",
    "Resource",
  ]) as any;

  const filteredEvents = getFilteredEvents([
    "BurnDonkey",
    // points
    "HyperstructureCoOwnersChange",
    "HyperstructureFinished",
    "GameEnded",
    // count
    "FragmentMineDiscovered",
  ]) as any;

  // fetch all existing entities from torii with optional component filtering
  const sync = await getSyncEntities(network.toriiClient, filteredComponents, undefined, [], 10_000);

  const eventSync = getSyncEvents(network.toriiClient, filteredEvents, undefined, [], 20_000, false, false);

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
