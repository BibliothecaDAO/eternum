import { AppStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import {
  ADMIN_BANK_ENTITY_ID,
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  PlayerStructure,
  SetupResult,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { getEntities, getEvents, setEntities } from "@dojoengine/state";
import { Clause, EntityKeysClause, ToriiClient } from "@dojoengine/torii-client";
import { debounce } from "lodash";
import {
  debouncedGetDonkeysAndArmiesFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetMarketFromTorii,
} from "./debounced-queries";

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
    if (logging) console.log("Entity updated", fetchedEntities, data);

    // Deep merge to handle nested structs
    const mergeDeep = (target: any, source: any) => {
      if (!source) return target;
      const output = { ...target };
      
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && 
            output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
          output[key] = mergeDeep(output[key], source[key]);
        } else {
          output[key] = source[key];
        }
      });
      
      return output;
    };

    // Merge new data with existing data for this entity, handling nested structs
    entityBatch[fetchedEntities] = entityBatch[fetchedEntities] 
      ? mergeDeep(entityBatch[fetchedEntities], data)
      : data;
      
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
  await syncEntitiesDebounced(setup.network.toriiClient, setup.network.contractComponents as any, [], true);

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

  // Sync Tile model
  start = performance.now();
  try {
    await getEntities(
      setup.network.toriiClient,
      {
        Keys: {
          keys: [undefined, undefined],
          pattern_matching: "FixedLen",
          models: ["s1_eternum-Tile"],
        },
      },
      setup.network.contractComponents as any,
      [],
      ["s1_eternum-Tile"],
      40_000,
      false,
    );
  } catch (error) {
    console.error("[sync] Error fetching tile entities:", error);
  }
  end = performance.now();
  console.log("[sync] tile query", end - start);
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
  "s1_eternum-BuildingCategoryConfig",
  "s1_eternum-StartingResourcesConfig",
  "s1_eternum-ResourceBridgeWhitelistConfig",
  "s1_eternum-StructureLevelConfig",
  "s1_eternum-ResourceList",
  "s1_eternum-LeaderboardRegisterContribution",
  "s1_eternum-LeaderboardRegisterShare",
];

const singleKeyModels = [
  "s1_eternum-AddressName",
  "s1_eternum-Trade",
  "s1_eternum-Structure",
  "s1_eternum-Hyperstructure",
  "s1_eternum-Guild",
  "s1_eternum-GuildMember",
  "s1_eternum-Season",
  "s1_eternum-Leaderboard",
  "s1_eternum-LeaderboardRegistered",
  "s1_eternum-LeaderboardRewardClaimed",
  "s1_eternum-LeaderboardEntry",
  "s1_eternum-BuildingCategoryConfig",
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
];

export const syncStructureData = async (
  dojo: SetupResult,
  structureEntityId: string,
  setLoading: (key: LoadingStateKey, value: boolean) => void,
  position?: { x: number; y: number },
) => {
  setLoading(LoadingStateKey.SelectedStructure, true);
  try {
    let start = performance.now();
    await debouncedGetEntitiesFromTorii(
      dojo.network.toriiClient,
      dojo.network.contractComponents as any,
      [structureEntityId],
      [
        "s1_eternum-Hyperstructure",
        "s1_eternum-Resource",
        "s1_eternum-Building",
        "s1_eternum-StructureBuildings",
      ],
      position ? [position] : undefined,
      () => setLoading(LoadingStateKey.SelectedStructure, false),
    );
    let end = performance.now();
    console.log("[composite] structure query", end - start);
  } catch (error) {
    console.error("Fetch failed", error);
    setLoading(LoadingStateKey.SelectedStructure, false);
  }
};

export const syncPlayerStructuresData = async (
  dojo: SetupResult,
  structures: PlayerStructure[],
  setLoading: (key: LoadingStateKey, value: boolean) => void,
) => {
  setLoading(LoadingStateKey.PlayerStructuresOneKey, true);
  setLoading(LoadingStateKey.PlayerStructuresTwoKey, true);
  setLoading(LoadingStateKey.DonkeysAndArmies, true);

  try {
    let start = performance.now();
    try {
      await debouncedGetEntitiesFromTorii(
        dojo.network.toriiClient,
        dojo.network.contractComponents as any,
        structures.map((structure) => structure.structure.entity_id.toString()),
        [
          "s1_eternum-Hyperstructure",
          "s1_eternum-Resource",
          "s1_eternum-Building",
          "s1_eternum-StructureBuildings",
        ],
        structures.map((structure) => ({ x: structure.position.x, y: structure.position.y })),
        () => {
          setLoading(LoadingStateKey.PlayerStructuresOneKey, false);
          setLoading(LoadingStateKey.PlayerStructuresTwoKey, false);
        },
      );
      let end = performance.now();
      console.log("[composite] buildings query", end - start);
    } catch (error) {
      console.error("Failed to fetch structure entities:", error);
      setLoading(LoadingStateKey.PlayerStructuresOneKey, false);
      setLoading(LoadingStateKey.PlayerStructuresTwoKey, false);
      throw error; // Re-throw to be caught by outer try-catch
    }

    start = performance.now();
    let end = performance.now();
    console.log("[composite] realm one key query", end - start);

    start = performance.now();
    try {
      await debouncedGetDonkeysAndArmiesFromTorii(
        dojo.network.toriiClient,
        dojo.network.contractComponents as any,
        structures.map((structure) => structure.structure.entity_id),
        () => setLoading(LoadingStateKey.DonkeysAndArmies, false),
      );
      end = performance.now();
      console.log("[composite] donkeys and armies query", end - start);
    } catch (error) {
      console.error("Failed to fetch donkeys and armies:", error);
      setLoading(LoadingStateKey.DonkeysAndArmies, false);
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error("Sync player structures failed:", error);
    // Ensure all loading states are reset on error
    setLoading(LoadingStateKey.PlayerStructuresOneKey, false);
    setLoading(LoadingStateKey.PlayerStructuresTwoKey, false);
    setLoading(LoadingStateKey.DonkeysAndArmies, false);
  }
};

export const syncMarketAndBankData = async (
  dojo: SetupResult,
  setLoading: (key: LoadingStateKey, value: boolean) => void,
) => {
  setLoading(LoadingStateKey.Market, true);
  setLoading(LoadingStateKey.Bank, true);

  try {
    let start = performance.now();
    await debouncedGetEntitiesFromTorii(
      dojo.network.toriiClient,
      dojo.network.contractComponents as any,
      [ADMIN_BANK_ENTITY_ID.toString()],
      ["s1_eternum-Hyperstructure", "s1_eternum-Resource", "s1_eternum-Building"],
      undefined,
      () => setLoading(LoadingStateKey.Bank, false),
    );
    let end = performance.now();
    console.log("[keys] bank query", end - start);

    await debouncedGetMarketFromTorii(dojo.network.toriiClient, dojo.network.contractComponents as any, () =>
      setLoading(LoadingStateKey.Market, false),
    );
  } catch (error) {
    console.error("Fetch failed", error);
  } finally {
    setLoading(LoadingStateKey.Bank, false);
    setLoading(LoadingStateKey.Market, false);
  }
};
