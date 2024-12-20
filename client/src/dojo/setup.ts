import { AppStore } from "@/hooks/store/useUIStore";
import { LoadingStateKey } from "@/hooks/store/useWorldLoading";
import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities, setEntities } from "@dojoengine/state";
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

export async function setup(config: DojoConfig & { state: AppStore }) {
  const network = await setupNetwork(config);
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
        [],
        configModels,
      ),
      getEntities(
        network.toriiClient,
        {
          Keys: {
            keys: [undefined, undefined],
            pattern_matching: "FixedLen",
            models: [],
          },
        },
        network.contractComponents as any,
        [],
        ["s0_eternum-CapacityConfig", "s0_eternum-ResourceCost"],
        40_000,
        false,
      ),
    ]);
  } finally {
    setLoading(LoadingStateKey.Config, false);
  }

  setLoading(LoadingStateKey.SingleKey, true);
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
    [],
    singleKeyModels,
    40_000,
    false,
  ).finally(() => {
    setLoading(LoadingStateKey.SingleKey, false);
  });

  const sync = await syncEntitiesDebounced(network.toriiClient, network.contractComponents as any, [], false);

  configManager.setDojo(components);

  return {
    network,
    components,
    systemCalls,
    sync,
  };
}

const configModels = [
  "s0_eternum-WorldConfig",
  "s0_eternum-SeasonAddressesConfig",
  "s0_eternum-SeasonBridgeConfig",
  "s0_eternum-HyperstructureResourceConfig",
  "s0_eternum-HyperstructureConfig",
  "s0_eternum-CapacityConfig",
  "s0_eternum-TravelStaminaCostConfig",
  "s0_eternum-SpeedConfig",
  "s0_eternum-MapConfig",
  "s0_eternum-SettlementConfig",
  "s0_eternum-TickConfig",
  "s0_eternum-StaminaRefillConfig",
  "s0_eternum-StaminaConfig",
  "s0_eternum-TravelFoodCostConfig",
  "s0_eternum-MercenariesConfig",
  "s0_eternum-WeightConfig",
  "s0_eternum-LevelingConfig",
  "s0_eternum-ProductionConfig",
  "s0_eternum-VRFConfig",
  "s0_eternum-BankConfig",
  "s0_eternum-BuildingGeneralConfig",
  "s0_eternum-BuildingConfig",
  "s0_eternum-TroopConfig",
  "s0_eternum-BattleConfig",
  "s0_eternum-BuildingCategoryPopConfig",
  "s0_eternum-PopulationConfig",
  "s0_eternum-QuestConfig",
  "s0_eternum-QuestRewardConfig",
  "s0_eternum-ResourceBridgeConfig",
  "s0_eternum-ResourceBridgeFeeSplitConfig",
  "s0_eternum-ResourceBridgeWhitelistConfig",
  "s0_eternum-RealmMaxLevelConfig",
  "s0_eternum-RealmLevelConfig",
];

const singleKeyModels = [
  "s0_eternum-AddressName",
  "s0_eternum-Realm",
  "s0_eternum-Bank",
  "s0_eternum-Trade",
  "s0_eternum-Status",
  "s0_eternum-Structure",
  "s0_eternum-Battle",
  "s0_eternum-Owner",
  "s0_eternum-Position",
  "s0_eternum-Population",
  "s0_eternum-Hyperstructure",
  "s0_eternum-Guild",
  "s0_eternum-GuildMember",
  "s0_eternum-EntityName",
];
