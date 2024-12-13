import { WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getEntities, getEvents, syncEntities } from "@dojoengine/state";
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

  const filteredModels = [
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
    "CapacityConfig",
  ];

  const filteredEvents = [
    "BurnDonkey",
    // points
    "HyperstructureCoOwnersChange",
    "HyperstructureFinished",
    "GameEnded",
  ];

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
  await getEntities(
    network.toriiClient,
    { Composite: { operator: "Or", clauses } },
    network.contractComponents as any,
    40_000,
  );

  await getEntities(
    network.toriiClient,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: filteredModels.map((model) => `s0_eternum-${model}`),
      },
    },
    network.contractComponents as any,
    40_000,
  );

  const sync = await syncEntities(network.toriiClient, network.contractComponents as any, [], false);

  const eventSync = getEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    undefined,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: filteredEvents.map((event) => `s0_eternum-${event}`),
      },
    },
    false,
    false,
  );

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
