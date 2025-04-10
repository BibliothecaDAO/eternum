import type { AppStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import {
  ADMIN_BANK_ENTITY_ID,
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  HYPERSTRUCTURE_CONFIG_ID,
  type PlayerStructure,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/types";
import { type SetupResult } from "@bibliothecadao/dojo";

import type { Entity, Schema } from "@dojoengine/recs";
import { getEntities, getEvents, setEntities } from "@dojoengine/state";
import type {
  Clause,
  EntityKeysClause,
  ToriiClient,
} from "@dojoengine/torii-client";
import {
  debouncedGetDonkeysAndArmiesFromTorii,
  debouncedGetEntitiesFromTorii,
  debouncedGetMarketFromTorii,
} from "./debounced-queries";

const syncEntitiesDebounced = async <S extends Schema>(
  client: ToriiClient,
  setupResult: SetupResult,
  entityKeyClause: EntityKeysClause[],
  logging = true,
  historical = false,
) => {
  if (logging) console.log("Starting syncEntities");

  // Create a queue for updates
  const updateQueue: Array<{ entityId: string; data: any }> = [];
  let isProcessing = false;

  const {
    network: { contractComponents: components, world },
  } = setupResult;

  // Function to process the next item in the queue
  const processNextInQueue = async () => {
    if (updateQueue.length === 0 || isProcessing) return;

    isProcessing = true;
    const batchSize = 10; // Process up to 10 updates at once
    const batch: Record<string, any> = {};

    // Take up to batchSize items from the queue
    const itemsToProcess = updateQueue.splice(0, batchSize);

    if (logging)
      console.log(`Processing batch of ${itemsToProcess.length} updates`);

    // Prepare the batch
    itemsToProcess.forEach(({ entityId, data }) => {
      // Deep merge logic for each entity
      if (batch[entityId]) {
        batch[entityId] = mergeDeep(batch[entityId], data);
      } else {
        batch[entityId] = data;
      }
    });

    if (Object.keys(batch).length > 0) {
      try {
        if (logging) console.log("Applying batch update", batch);

        for (const entityId in batch) {
          const value = batch[entityId];
          // this is an entity that has been deleted
          if (Object.keys(value).length === 0) {
            world.deleteEntity(entityId as Entity);
          }
        }

        setEntities(batch, world.components, logging);
      } catch (error) {
        console.error("Error processing entity batch:", error);
      }
    }

    isProcessing = false;

    // If there are more items, continue processing
    if (updateQueue.length > 0) {
      setTimeout(processNextInQueue, 0); // Use setTimeout to avoid blocking
    }
  };

  // Deep merge to handle nested structs
  const mergeDeep = (target: any, source: any) => {
    if (!source) return target;
    const output = { ...target };

    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key]) &&
        output[key] &&
        typeof output[key] === "object" &&
        !Array.isArray(output[key])
      ) {
        output[key] = mergeDeep(output[key], source[key]);
      } else {
        output[key] = source[key];
      }
    });

    return output;
  };

  // Function to add update to queue and trigger processing
  const queueUpdate = (entityId: string, data: any) => {
    updateQueue.push({ entityId, data });

    // Debounce the processing to batch updates
    if (!isProcessing) {
      setTimeout(processNextInQueue, 50); // Small delay to allow batching
    }
  };

  // Handle entity updates
  const entitySub = await client.onEntityUpdated(
    entityKeyClause,
    (fetchedEntities: any, data: any) => {
      if (logging) console.log("Entity updated", fetchedEntities, data);

      try {
        queueUpdate(fetchedEntities, data);
      } catch (error) {
        console.error("Error queuing entity update:", error);
      }
    },
  );

  // Handle event message updates
  const eventSub = await client.onEventMessageUpdated(
    entityKeyClause,
    (fetchedEntities: any, data: any) => {
      if (logging) console.log("Event message updated", fetchedEntities);

      try {
        queueUpdate(fetchedEntities, data);
      } catch (error) {
        console.error("Error queuing event message update:", error);
      }
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

  await syncEntitiesDebounced(setup.network.toriiClient, setup, [], false);

  setLoading(LoadingStateKey.Config, true);
  try {
    const start = performance.now();
    try {
      await getEntities(
        setup.network.toriiClient,
        { Composite: { operator: "Or", clauses: configClauses } },
        setup.network.contractComponents as any,
        [],
        configModels,
        40_000,
        false,
      );
      const end = performance.now();
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
    // todo: only 1 undefined clause variable len
    await getEntities(
      setup.network.toriiClient,
      {
        Composite: {
          operator: "Or",
          clauses: [
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

// todo: only 1 undefined clause variable len
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
  "s1_eternum-HyperstructureConstructConfig",
  "s1_eternum-WeightConfig",
  "s1_eternum-ResourceFactoryConfig",
  "s1_eternum-BuildingCategoryConfig",
  "s1_eternum-ResourceBridgeWhitelistConfig",
  "s1_eternum-StructureLevelConfig",
  "s1_eternum-ResourceList",
  "s1_eternum-SeasonPrize",
  "s1_eternum-GuildWhitelist",
  "s1_eternum-HyperstructureRequirements",
];

const singleKeyModels = [
  "s1_eternum-AddressName",
  "s1_eternum-Structure",
  // Guild
  "s1_eternum-Guild",
  "s1_eternum-GuildMember",
];

const eventModels = [
  "s1_eternum-SeasonEnded",
  "s1_eternum-AcceptOrder",
  "s1_eternum-SwapEvent",
  "s1_eternum-LiquidityEvent",
];

const hyperstructureModels = [
  // Hyperstructure
  "s1_eternum-HyperstructureGlobals",
  "s1_eternum-Hyperstructure",
  "s1_eternum-HyperstructureShareholders",
  // Leaderboard
  "s1_eternum-PlayerRegisteredPoints",
  "s1_eternum-PlayerConstructionPoints",
];

export const syncStructureData = async (
  dojo: SetupResult,
  structureEntityId: string,
  setLoading: (key: LoadingStateKey, value: boolean) => void,
  position?: { x: number; y: number },
) => {
  setLoading(LoadingStateKey.SelectedStructure, true);
  try {
    const start = performance.now();
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
    const end = performance.now();
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
          "s1_eternum-ResourceArrival",
        ],
        structures.map((structure) => ({
          x: structure.position.x,
          y: structure.position.y,
        })),
        () => {
          setLoading(LoadingStateKey.PlayerStructuresOneKey, false);
          setLoading(LoadingStateKey.PlayerStructuresTwoKey, false);
        },
      );
      const end = performance.now();
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
    const start = performance.now();
    await debouncedGetEntitiesFromTorii(
      dojo.network.toriiClient,
      dojo.network.contractComponents as any,
      [ADMIN_BANK_ENTITY_ID.toString()],
      [
        "s1_eternum-Hyperstructure",
        "s1_eternum-Resource",
        "s1_eternum-Building",
      ],
      undefined,
      () => setLoading(LoadingStateKey.Bank, false),
    );
    const end = performance.now();
    console.log("[keys] bank query", end - start);

    await debouncedGetMarketFromTorii(
      dojo.network.toriiClient,
      dojo.network.contractComponents as any,
      () => setLoading(LoadingStateKey.Market, false),
    );
  } catch (error) {
    console.error("Fetch failed", error);
  } finally {
    setLoading(LoadingStateKey.Bank, false);
    setLoading(LoadingStateKey.Market, false);
  }
};
