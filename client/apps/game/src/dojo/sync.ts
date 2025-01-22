import { AppStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { ETERNUM_CONFIG } from "@/utils/config";
import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  configManager,
  HYPERSTRUCTURE_CONFIG_ID,
  SetupResult,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities, getEvents, setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, ToriiClient } from "@dojoengine/torii-client";
import { debounce } from "lodash";

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
      if (logging) console.log("Applying batch update", entityBatch);

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

export const initialSync = async (setup: SetupResult, state: AppStore) => {
  const setLoading = state.setLoading;

  // const sync = await syncEntitiesDebounced(
  await syncEntitiesDebounced(setup.network.toriiClient, setup.network.contractComponents as any, [], false);

  setLoading(LoadingStateKey.Config, true);
  try {
    let start = performance.now();
    Promise.all([
      await getEntities(
        setup.network.toriiClient,
        { Composite: { operator: "Or", clauses: configClauses } },
        setup.network.contractComponents as any,
        [],
        configModels,
        40_000,
        false,
      ),
      await getEntities(
        setup.network.toriiClient,
        {
          Keys: {
            keys: [undefined, undefined],
            pattern_matching: "VariableLen",
            models: [],
          },
        },
        setup.network.contractComponents as any,
        [],
        [
          "s1_eternum-CapacityConfig",
          "s1_eternum-ResourceCost",
          "s1_eternum-LeaderboardRegisterContribution",
          "s1_eternum-LeaderboardRegisterShare",
          "s1_eternum-CapacityConfigCategory",
          "s1_eternum-ResourceCost",
        ],
        40_000,
        false,
      ),
    ]);
    let end = performance.now();
    console.log("[composite] big config query", end - start);
  } finally {
    setLoading(LoadingStateKey.Config, false);
  }

  setLoading(LoadingStateKey.Hyperstructure, true);
  let start = performance.now();
  await getEntities(
    setup.network.toriiClient,
    {
      Composite: {
        operator: "Or",
        clauses: [
          {
            Keys: {
              keys: [undefined, undefined],
              pattern_matching: "FixedLen",
              models: [],
            },
          },
          {
            Keys: {
              keys: [undefined, undefined, undefined],
              pattern_matching: "FixedLen",
              models: [],
            },
          },
        ],
      },
    },
    setup.network.contractComponents as any,
    [],
    [
      "s1_eternum-Contribution",
      "s1_eternum-LeaderboardRegisterShare",
      "s1_eternum-Epoch",
      "s1_eternum-Progress",
      "s1_eternum-LeaderboardRegisterContribution",
    ],
    40_000,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.Hyperstructure, false);
  });
  let end = performance.now();
  console.log("[composite] hyperstructure query", end - start);

  setLoading(LoadingStateKey.SingleKey, true);
  start = performance.now();
  await getEntities(
    setup.network.toriiClient,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "FixedLen",
        models: [],
      },
    },
    setup.network.contractComponents as any,
    [],
    singleKeyModels,
    40_000,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.SingleKey, false);
  });
  end = performance.now();
  console.log("[composite] single key query", end - start);

  const eternumConfig = await ETERNUM_CONFIG();
  console.log({ eternumConfig });
  configManager.setDojo(setup.components, eternumConfig);

  setLoading(LoadingStateKey.Events, true);

  start = performance.now();
  getEvents(
    setup.network.toriiClient,
    setup.network.contractComponents.events as any,
    [],
    [
      "s1_eternum-GameEnded",
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
    20000,
    {
      Keys: {
        keys: [undefined],
        pattern_matching: "VariableLen",
        models: [],
      },
    },
    false,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.Events, false);
  });
  end = performance.now();
  console.log("event query", end - start);
};

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

const configModels = [
  "s1_eternum-WorldConfig",
  "s1_eternum-SeasonAddressesConfig",
  "s1_eternum-SeasonBridgeConfig",
  "s1_eternum-HyperstructureResourceConfig",
  "s1_eternum-HyperstructureConfig",
  "s1_eternum-CapacityConfig",
  "s1_eternum-TravelStaminaCostConfig",
  "s1_eternum-SpeedConfig",
  "s1_eternum-MapConfig",
  "s1_eternum-SettlementConfig",
  "s1_eternum-TickConfig",
  "s1_eternum-StaminaRefillConfig",
  "s1_eternum-StaminaConfig",
  "s1_eternum-TravelFoodCostConfig",
  "s1_eternum-MercenariesConfig",
  "s1_eternum-WeightConfig",
  "s1_eternum-LevelingConfig",
  "s1_eternum-ProductionConfig",
  "s1_eternum-VRFConfig",
  "s1_eternum-BankConfig",
  "s1_eternum-BuildingGeneralConfig",
  "s1_eternum-BuildingConfig",
  "s1_eternum-TroopConfig",
  "s1_eternum-BattleConfig",
  "s1_eternum-BuildingCategoryPopConfig",
  "s1_eternum-PopulationConfig",
  "s1_eternum-QuestConfig",
  "s1_eternum-QuestRewardConfig",
  "s1_eternum-ResourceBridgeConfig",
  "s1_eternum-ResourceBridgeFeeSplitConfig",
  "s1_eternum-ResourceBridgeWhitelistConfig",
  "s1_eternum-RealmMaxLevelConfig",
  "s1_eternum-RealmLevelConfig",
];

const singleKeyModels = [
  "s1_eternum-AddressName",
  "s1_eternum-Realm",
  "s1_eternum-Bank",
  "s1_eternum-Trade",
  "s1_eternum-Status",
  "s1_eternum-Structure",
  "s1_eternum-Battle",
  "s1_eternum-Owner",
  "s1_eternum-Position",
  "s1_eternum-Population",
  "s1_eternum-Hyperstructure",
  "s1_eternum-Guild",
  "s1_eternum-GuildMember",
  "s1_eternum-EntityName",
  "s1_eternum-Season",
  "s1_eternum-Leaderboard",
  "s1_eternum-LeaderboardRegistered",
  "s1_eternum-LeaderboardRewardClaimed",
  "s1_eternum-LeaderboardEntry",
];
