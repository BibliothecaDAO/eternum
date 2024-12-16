import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities, getEvents, setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, ToriiClient } from "@dojoengine/torii-client";
import { debounce } from "lodash";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { ClientConfigManager } from "./modelManager/ConfigManager";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

export const syncEntitiesDebounced = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityKeyClause: EntityKeysClause[],
  logging: boolean = true,
  historical: boolean = false,
) => {
  if (logging) console.log("Starting syncEntities");

  let entityBatch: Record<string, any> = {};

  const debouncedSetEntities = debounce(() => {
    if (Object.keys(entityBatch).length > 0) {
      console.log("Applying batch update", entityBatch);
      setEntities(entityBatch, components, logging);
      entityBatch = {}; // Clear the batch after applying
    }
  }, 1000); // Increased debounce time to 1 second for larger batches

  // Handle entity updates
  const entitySub = await client.onEntityUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Entity updated", fetchedEntities);
    // Merge new data with existing data for this entity
    entityBatch[fetchedEntities] = {
      ...entityBatch[fetchedEntities],
      ...data,
    };
    debouncedSetEntities();
  });

  // Handle event message updates
  const eventSub = await client.onEventMessageUpdated(
    entityKeyClause,
    historical,
    (fetchedEntities: any, data: any) => {
      if (logging) console.log("Event message updated", fetchedEntities);
      // Merge new data with existing data for this entity
      entityBatch[fetchedEntities] = {
        ...entityBatch[fetchedEntities],
        ...data,
      };
      debouncedSetEntities();
    },
  );

  // Return combined subscription that can cancel both
  return {
    cancel: () => {
      entitySub.cancel();
      eventSub.cancel();
    },
  };
};

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  const configClauses: Clause[] = [
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined, undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString(), undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [BUILDING_CATEGORY_POPULATION_CONFIG_ID.toString(), undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    {
      Keys: {
        keys: [HYPERSTRUCTURE_CONFIG_ID.toString(), undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
  ];

  await getEntities(
    network.toriiClient,
    { Composite: { operator: "Or", clauses: configClauses } },
    network.contractComponents as any,
  );

  // fetch all existing entities from torii
  await getEntities(
    network.toriiClient,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    network.contractComponents as any,
    40_000,
    false,
  );

  const sync = await syncEntitiesDebounced(network.toriiClient, network.contractComponents as any, [], false);

  configManager.setDojo(components);

  const eventSync = getEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    20000,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [
          "s0_eternum-GameEnded",
          "s0_eternum-HyperstructureFinished",
          "s0_eternum-BattleStartData",
          "s0_eternum-BattleJoinData",
          "s0_eternum-BattleLeaveData",
          "s0_eternum-BattlePillageData",
          "s0_eternum-AcceptOrder",
          "s0_eternum-SwapEvent",
          "s0_eternum-LiquidityEvent",
          "s0_eternum-HyperstructureContribution",
          "s0_eternum-MapExplored",
        ],
      },
    },
    false,
    false,
  );

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
