import { AppStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
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
    try {
      await Promise.all([
        await getEntities(
          setup.network.toriiClient,
          { Composite: { operator: "Or", clauses: configClauses } },
          setup.network.contractComponents as any,
          [],
          configModels,
          40_000,
          false,
        ),
      ]);
      let end = performance.now();
      console.log("[sync] big config query", end - start);
    } catch (error) {
      console.error("[sync] Error fetching config entities:", error);
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error("[sync] Fatal error during config sync:", error);
  } finally {
    setLoading(LoadingStateKey.Config, false);
  }

  setLoading(LoadingStateKey.Hyperstructure, true);
  let start = performance.now();
  try {
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
      hyperstructureModels,
      40_000,
      false,
    );
  } catch (error) {
    console.error("[sync] Error fetching hyperstructure entities:", error);
  } finally {
    setLoading(LoadingStateKey.Hyperstructure, false);
  }
  let end = performance.now();
  console.log("[sync] hyperstructure query", end - start);

  setLoading(LoadingStateKey.SingleKey, true);
  start = performance.now();
  try {
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
    );
  } catch (error) {
    console.error("[sync] Error fetching single key entities:", error);
  } finally {
    setLoading(LoadingStateKey.SingleKey, false);
  }
  end = performance.now();
  console.log("[sync] single key query", end - start);

  setLoading(LoadingStateKey.Events, true);

  start = performance.now();
  try {
    await getEvents(
      setup.network.toriiClient,
      setup.network.contractComponents.events as any,
      [],
      eventModels,
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
    );
  } catch (error) {
    console.error("[sync] Error fetching event entities:", error);
  } finally {
    setLoading(LoadingStateKey.Events, false);
  }
  end = performance.now();
  console.log("event query", end - start);
};

const configClauses: Clause[] = [
  {
    Keys: {
      keys: [WORLD_CONFIG_ID.toString()],
      pattern_matching: "VariableLen",
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
  {
    Keys: {
      keys: [undefined],
      pattern_matching: "FixedLen",
      models: [],
    },
  },
  {
    Keys: {
      keys: [undefined, undefined],
      pattern_matching: "VariableLen",
      models: [],
    },
  },
];

const configModels = [
  "s1_eternum-WorldConfig",
  "s1_eternum-HyperstructureResourceConfig",
  "s1_eternum-WeightConfig",
  "s1_eternum-ProductionConfig",
  "s1_eternum-BuildingConfig",
  "s1_eternum-BuildingCategoryPopConfig",
  "s1_eternum-QuestRewardConfig",
  "s1_eternum-ResourceBridgeWhitelistConfig",
  "s1_eternum-RealmLevelConfig",
  "s1_eternum-ResourceList",
  "s1_eternum-LeaderboardRegisterContribution",
  "s1_eternum-LeaderboardRegisterShare",
];

const singleKeyModels = [
  "s1_eternum-AddressName",
  "s1_eternum-Realm",
  "s1_eternum-Bank",
  "s1_eternum-Trade",
  "s1_eternum-Structure",
  "s1_eternum-Owner",
  "s1_eternum-Position",
  "s1_eternum-Hyperstructure",
  "s1_eternum-Guild",
  "s1_eternum-GuildMember",
  "s1_eternum-Season",
  "s1_eternum-Leaderboard",
  "s1_eternum-LeaderboardRegistered",
  "s1_eternum-LeaderboardRewardClaimed",
  "s1_eternum-LeaderboardEntry",
];

const eventModels = [
  "s1_eternum-GameEnded",
  "s1_eternum-HyperstructureFinished",
  "s1_eternum-AcceptOrder",
  "s1_eternum-SwapEvent",
  "s1_eternum-LiquidityEvent",
  "s1_eternum-HyperstructureContribution",
];

const hyperstructureModels = [
  "s1_eternum-HyperstructureResourceConfig",
  "s1_eternum-WeightConfig",
  "s1_eternum-ProductionConfig",
  "s1_eternum-BuildingConfig",
  "s1_eternum-BuildingCategoryPopConfig",
];
