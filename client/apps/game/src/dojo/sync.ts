import { getFirstStructure } from "@/hooks/helpers/use-navigate-to-realm-view-by-account";
import { AppStore } from "@/hooks/store/use-ui-store";
import { SetupResult } from "@bibliothecadao/eternum";
import { Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { EntityKeysClause, ToriiClient } from "@dojoengine/torii-client";
import { getConfigFromTorii, getSeasonPrizeFromTorii, getStructuresDataFromTorii } from "./queries";
import { handleExplorerTroopsIfDeletion } from "./utils";

export const EVENT_QUERY_LIMIT = 40_000;

const syncEntitiesDebounced = async <S extends Schema>(
  client: ToriiClient,
  setupResult: SetupResult,
  entityKeyClause: EntityKeysClause[],
  logging: boolean = true,
  historical: boolean = false,
) => {
  if (logging) console.log("Starting syncEntities");

  // Create a queue for updates
  const updateQueue: Array<{ entityId: string; data: any }> = [];
  let isProcessing = false;

  const {
    network: { contractComponents: components },
  } = setupResult;

  // Function to process the next item in the queue
  const processNextInQueue = async () => {
    if (updateQueue.length === 0 || isProcessing) return;

    isProcessing = true;
    const batchSize = 10; // Process up to 10 updates at once
    const batch: Record<string, any> = {};

    // Take up to batchSize items from the queue
    const itemsToProcess = updateQueue.splice(0, batchSize);

    if (logging) console.log(`Processing batch of ${itemsToProcess.length} updates`);

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

        handleExplorerTroopsIfDeletion(batch, components, logging);
        setEntities(batch, components as any, logging);
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
  const entitySub = await client.onEntityUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Entity updated", fetchedEntities, data);

    try {
      queueUpdate(fetchedEntities, data);
    } catch (error) {
      console.error("Error queuing entity update:", error);
    }
  });

  // Handle event message updates
  const eventSub = await client.onEventMessageUpdated(
    entityKeyClause,
    historical,
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

// initial sync runs before the game is playable and should sync minimal data
export const initialSync = async (setup: SetupResult, state: AppStore) => {
  await syncEntitiesDebounced(setup.network.toriiClient, setup, [], true);

  // SPECTATOR REALM
  const firstNonOwnedStructure = await getFirstStructure(setup);
  if (firstNonOwnedStructure) {
    state.setSpectatorRealmEntityId(firstNonOwnedStructure.entityId);
    await getStructuresDataFromTorii(setup.network.toriiClient, setup.network.contractComponents as any, [
      firstNonOwnedStructure.entityId,
    ]);
  }

  // can't sync if dont know player address
  // SYNC FIRST PLAYER OWNED REALM
  // const firstPlayerOwnedStructure = await getFirstStructure(setup, setup);
  // if (firstPlayerOwnedStructure) {
  //   await syncStructuresData(setup, [firstPlayerOwnedStructure.entityId], (isLoading: boolean) =>
  //     setLoading(LoadingStateKey.Realm, isLoading),
  //   );
  // }

  await getConfigFromTorii(setup.network.toriiClient, setup.network.contractComponents.events as any);
  await getSeasonPrizeFromTorii(setup.network.toriiClient, setup.network.contractComponents.events as any);

  // // Sync Tile model
  // start = performance.now();
  // try {
  //   await getEntities(
  //     setup.network.toriiClient,
  //     {
  //       Keys: {
  //         keys: [undefined, undefined],
  //         pattern_matching: "FixedLen",
  //         models: ["s1_eternum-Tile"],
  //       },
  //     },
  //     setup.network.contractComponents as any,
  //     [],
  //     ["s1_eternum-Tile"],
  //     40_000,
  //     false,
  //   );
  // } catch (error) {
  //   console.error("[sync] Error fetching tile entities:", error);
  // }
  // end = performance.now();
  // console.log("[sync] tile query", end - start);
};

// const singleKeyModels = [
//   // Guild
//   "s1_eternum-Guild",
//   "s1_eternum-GuildMember",
// ];

// for each structure:
// get the structure
// get the buildings
// get the resources
// get the resource arrivals
// get the armies
