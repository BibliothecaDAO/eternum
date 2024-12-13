import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  WORLD_CONFIG_ID
} from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { getSyncEvents, setEntities, syncEntities } from "@dojoengine/state";
import { Clause } from "@dojoengine/torii-client";
import { everyModel } from "./allModels";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { getAllEntities, getEntitiesByTime, getLastSync } from "./indexedDB";
import { ClientConfigManager } from "./modelManager/ConfigManager";
import { setupNetwork } from "./setupNetwork";


export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);


  // set entities from indexedDB
  const entities = await getAllEntities();
  setEntities(entities, network.contractComponents as any, false);
  console.log("cached entities", entities);

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

 let time = getLastSync()

 if(!time) {
  time = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
 }

  const createClause1 = everyModel.slice(0, 60).map((model) => {
    return {
      Member: {
        model: `${model}`,
        member: "internal_updated_at",
        operator: "Gte",
        value: { String: time },
      },
    };
  });

  const createClause2 = everyModel.slice(60).map((model) => {
    return {
      Member: {
        model: `${model}`,
        member: "internal_updated_at",
        operator: "Gte",
        value: { String: time },
      },
    };
  });

  await getEntitiesByTime(network.toriiClient, {
    Composite: {
      operator: "Or",
      clauses: [
        ...createClause1 as any,
      ],
    },
  }, [], 20000, false);

  await getEntitiesByTime(network.toriiClient, {
    Composite: {
      operator: "Or",
      clauses: [
        ...createClause2 as any,
      ],
    },
  }, [], 20000, false);

  // fetch all existing entities from indexedDB
  // await getEntities(network.toriiClient, {Composite: {operator: "Or", clauses: configClauses}}, network.contractComponents as any);

  // const clauses: Clause[] = [
  //   {
  //     Keys: {
  //       keys: [undefined],
  //       pattern_matching: "FixedLen",
  //       models: [],
  //     },
  //   },
  // ];

  // // fetch all existing entities from torii
  // await getEntities(
  //   network.toriiClient,
  //   { Composite: { operator: "Or", clauses } },
  //   network.contractComponents as any,
  //   40_000,
  // );

  // setup sync to all
  const sync = await syncEntities(network.toriiClient, network.contractComponents as any, [], false);

  configManager.setDojo(components);

  const eventSync = getSyncEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    undefined,
    [],
    20_000,
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
