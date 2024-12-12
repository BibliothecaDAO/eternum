import { WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities, getSyncEvents, syncEntities } from "@dojoengine/state";
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
    "SpeedConfig",
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
  // fetch all existing entities from torii with optional component filtering
  await getSyncEntities(
    network.toriiClient,
    filteredComponents,
    { Composite: { operator: "Or", clauses } },
    [],
    10_000,
  );

  const sync = await syncEntities(network.toriiClient, filteredComponents, [], false);

  configManager.setDojo(components);

  const eventSync = getSyncEvents(network.toriiClient, filteredEvents, undefined, [], 20_000, false, false);

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
