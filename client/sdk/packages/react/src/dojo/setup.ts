import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  ClientConfigManager,
  createClientComponents,
  HYPERSTRUCTURE_CONFIG_ID,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities, getEvents, setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, ToriiClient } from "@dojoengine/torii-client";
import { debounce } from "lodash";
import { AppStore, LoadingStateKey } from "../hooks/store";
import { createSystemCalls } from "./create-system-calls";
import { setupNetwork } from "./setup-network";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export const configManager = ClientConfigManager.instance();

const syncEntitiesDebounced = async <S extends Schema>(
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
      // console.log("Applying batch update", entityBatch);
      setEntities(entityBatch, components, logging);
      entityBatch = {}; // Clear the batch after applying
    }
  }, 200); // Increased debounce time to 1 second for larger batches

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

export async function setup(
  config: DojoConfig & { state: AppStore },
  env: { viteVrfProviderAddress: string; vitePublicDev: boolean },
) {
  const network = await setupNetwork(config, env);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const setLoading = config.state.setLoading;

  const configClauses: Clause[] = [
    {
      Keys: {
        keys: [WORLD_CONFIG_ID.toString()],
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
        keys: [WORLD_CONFIG_ID.toString(), undefined, undefined],
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
        keys: [HYPERSTRUCTURE_CONFIG_ID.toString()],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
  ];

  setLoading(LoadingStateKey.Config, true);
  try {
    await Promise.all([
      getEntities(
        network.toriiClient,
        { Composite: { operator: "Or", clauses: configClauses } },
        network.contractComponents as any,
      ),
      getEntities(
        network.toriiClient,
        {
          Keys: {
            keys: [undefined, undefined],
            pattern_matching: "FixedLen",
            models: ["s1_eternum-CapacityConfigCategory", "s1_eternum-ResourceCost"],
          },
        },
        network.contractComponents as any,
        [],
        [],
        40_000,
        false,
      ),
    ]);
  } finally {
    setLoading(LoadingStateKey.Config, false);
  }

  // fetch all existing entities from torii
  setLoading(LoadingStateKey.Hyperstructure, true);
  await getEntities(
    network.toriiClient,
    {
      Composite: {
        operator: "Or",
        clauses: [
          {
            Keys: {
              keys: [undefined, undefined],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-Epoch", "s1_eternum-Progress", "s1_eternum-LeaderboardRegisterContribution"],
            },
          },
          {
            Keys: {
              keys: [undefined, undefined, undefined],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-Contribution", "s1_eternum-LeaderboardRegisterShare"],
            },
          },
        ],
      },
    },
    network.contractComponents as any,
    [],
    [],
    40_000,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.Hyperstructure, false);
  });

  setLoading(LoadingStateKey.SingleKey, true);
  await getEntities(
    network.toriiClient,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [
          "s1_eternum-AddressName",
          "s1_eternum-Realm",
          "s1_eternum-PopulationConfig",
          "s1_eternum-CapacityConfig",
          "s1_eternum-ProductionConfig",
          "s1_eternum-RealmLevelConfig",
          "s1_eternum-BankConfig",
          "s1_eternum-Bank",
          "s1_eternum-Trade",
          "s1_eternum-Structure",
          "s1_eternum-Battle",
          "s1_eternum-Guild",
          "s1_eternum-LeaderboardRegistered",
          "s1_eternum-Leaderboard",
          "s1_eternum-LeaderboardRewardClaimed",
          "s1_eternum-LeaderboardEntry",
        ],
      },
    },
    network.contractComponents as any,
    [],
    [],
    40_000,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.SingleKey, false);
  });

  const sync = await syncEntitiesDebounced(network.toriiClient, network.contractComponents as any, [], false);
  const eternumConfig = await ETERNUM_CONFIG();
  configManager.setDojo(components, eternumConfig);

  // setLoading(LoadingStateKey.Events, true);

  await getEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    [],
    [],
    20000,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: ["s1_eternum-GameEnded"],
      },
    },
    false,
    false,
  );
  // .finally(() => {
  //   setLoading(LoadingStateKey.Events, false);
  // });

  const eventSync = getEvents(
    network.toriiClient,
    network.contractComponents.events as any,
    [],
    [],
    20000,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [
          // "s1_eternum-GameEnded",
          "s1_eternum-HyperstructureFinished",
          "s1_eternum-BattleClaimData",
          "s1_eternum-BattleJoinData",
          "s1_eternum-BattleLeaveData",
          "s1_eternum-BattlePillageData",
          "s1_eternum-BattleStartData",
          "s1_eternum-AcceptOrder",
          "s1_eternum-SwapEvent",
          "s1_eternum-LiquidityEvent",
          "s1_eternum-HyperstructureContribution",
        ],
      },
    },
    false,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.Events, false);
  });

  return {
    network,
    components,
    systemCalls,
    sync,
    eventSync,
  };
}
