import type { AppStore } from "@/hooks/store/use-ui-store";
import { type SetupResult } from "@bibliothecadao/dojo";

import { getFirstStructureFromToriiClient } from "@bibliothecadao/torii-client";
import type { Entity, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, ToriiClient } from "@dojoengine/torii-client";
import { GameScore } from "metagame-sdk";
import { debouncedGetQuestsFromTorii } from "./debounced-queries";
import {
  getAddressNamesFromTorii,
  getBankStructuresFromTorii,
  getConfigFromTorii,
  getGuildsFromTorii,
  getSeasonPrizeFromTorii,
  getStructuresDataFromTorii,
} from "./queries";

export const EVENT_QUERY_LIMIT = 40_000;

const syncEntitiesDebounced = async <S extends Schema>(
  client: ToriiClient,
  setupResult: SetupResult,
  entityKeyClause: Clause | undefined | null,
  logging = false,
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

        for (const entityId in batch) {
          const value = batch[entityId];
          // this is an entity that has been deleted
          if (Object.keys(value.models).length === 0) {
            world.deleteEntity(entityId as Entity);
          }
        }

        const modelsArray = Object.values(batch).map((value) => {
          return { hashed_keys: value.hashed_keys, models: value.models };
        });

        setEntities(modelsArray, world.components, logging);
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
  const entitySub = client.onEntityUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Entity updated", fetchedEntities, data);

    try {
      queueUpdate(fetchedEntities, data);
    } catch (error) {
      console.error("Error queuing entity update:", error);
    }
  });

  // Handle event message updates
  const eventSub = client.onEventMessageUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Event message updated", fetchedEntities);

    try {
      queueUpdate(fetchedEntities, data);
    } catch (error) {
      console.error("Error queuing event message update:", error);
    }
  });

  // Return combined subscription that can cancel both
  return {
    cancel: () => {
      entitySub.cancel();
      eventSub.cancel();
    },
  };
};

// initial sync runs before the game is playable and should sync minimal data
export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
) => {
  await syncEntitiesDebounced(setup.network.toriiClient, setup, null, false);

  let start = performance.now();
  let end;

  // BANKS
  // todo: this is not needed for initial sync, should be placed to market sync but currently not working
  await getBankStructuresFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] bank structures query", end - start);
  setInitialSyncProgress(10);

  // SPECTATOR REALM
  const firstNonOwnedStructure = await getFirstStructureFromToriiClient(setup.network.toriiClient);

  if (firstNonOwnedStructure) {
    state.setSpectatorRealmEntityId(firstNonOwnedStructure.entityId);
    await getStructuresDataFromTorii(setup.network.toriiClient, setup.network.contractComponents as any, [
      { entityId: firstNonOwnedStructure.entityId, position: firstNonOwnedStructure.position },
    ]);
    end = performance.now();
    console.log("[sync] first structure query", end - start);
    setInitialSyncProgress(25);
  }

  start = performance.now();
  await getConfigFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] config query", end - start);
  setInitialSyncProgress(50);

  start = performance.now();
  await getSeasonPrizeFromTorii(setup.network.toriiClient, setup.network.contractComponents.events as any);
  end = performance.now();
  console.log("[sync] season prize query", end - start);
  setInitialSyncProgress(75);

  start = performance.now();
  await getAddressNamesFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] address names query", end - start);
  setInitialSyncProgress(90);

  start = performance.now();
  await getGuildsFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] guilds query", end - start);
  setInitialSyncProgress(100);
};

export const syncQuests = async (setup: SetupResult, gameAddress: string, questGames: GameScore[]) => {
  const start = performance.now();
  await debouncedGetQuestsFromTorii(
    setup.network.toriiClient,
    setup.network.contractComponents as any,
    gameAddress,
    questGames,
  );
  const end = performance.now();
  console.log("[sync] quests query", end - start);
};
