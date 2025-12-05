import type { AppStore } from "@/hooks/store/use-ui-store";
import { type SetupResult } from "@bibliothecadao/dojo";

import { sqlApi } from "@/services/api";
import { MAP_DATA_REFRESH_INTERVAL, MapDataStore } from "@bibliothecadao/eternum";
import type { Component, Entity, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, ToriiClient, Entity as ToriiEntity } from "@dojoengine/torii-wasm/types";
import {
  getAddressNamesFromTorii,
  getBankStructuresFromTorii,
  getConfigFromTorii,
  getGuildsFromTorii,
  getStructuresDataFromTorii,
} from "./queries";
import { ToriiSyncWorkerManager } from "./sync-worker-manager";

export const EVENT_QUERY_LIMIT = 40_000;

let entityStreamSubscription: { cancel: () => void } | null = null;

function isToriiDeleteNotification(entity: ToriiEntity): boolean {
  return Object.keys(entity.models).length === 0;
}

type BatchPayload = { upserts: ToriiEntity[]; deletions: string[] };

interface QueueProcessor {
  queueUpdate: (entityId: string, data: ToriiEntity, origin?: "entity" | "event") => void;
  dispose: () => void;
}

const createMainThreadQueueProcessor = (
  applyBatch: (batch: BatchPayload) => void,
  logging: boolean,
): QueueProcessor => {
  const updateQueue: Array<{ entityId: string; data: ToriiEntity }> = [];
  let isProcessing = false;
  let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const mergeDeep = (target: ToriiEntity, source: ToriiEntity): ToriiEntity => {
    if (!source) return target;
    const output = { ...target } as ToriiEntity;
    const mutableOutput = output as unknown as Record<string, unknown>;
    const sourceRecord = source as unknown as Record<string, unknown>;

    Object.keys(sourceRecord).forEach((key) => {
      const sourceValue = sourceRecord[key];
      const targetValue = mutableOutput[key];

      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        mutableOutput[key] = mergeDeep(targetValue as ToriiEntity, sourceValue as ToriiEntity);
      } else {
        mutableOutput[key] = sourceValue;
      }
    });

    return output;
  };

  const processNextInQueue = async () => {
    if (updateQueue.length === 0 || isProcessing) return;

    isProcessing = true;
    const batchSize = 10;
    const batchRecord: Record<string, ToriiEntity> = {};

    const itemsToProcess = updateQueue.splice(0, batchSize);
    if (logging) console.log(`Processing batch of ${itemsToProcess.length} updates`);

    itemsToProcess.forEach(({ entityId, data }) => {
      const isEntityDelete = isToriiDeleteNotification(data);
      if (isEntityDelete) {
        batchRecord[entityId] = data;
      }
      if (batchRecord[entityId]) {
        const entityHasBeenDeleted = isToriiDeleteNotification(batchRecord[entityId]);
        if (entityHasBeenDeleted) return;
        batchRecord[entityId] = mergeDeep(batchRecord[entityId], data);
      } else {
        batchRecord[entityId] = data;
      }
    });

    const entityIds = Object.keys(batchRecord);
    if (entityIds.length > 0) {
      try {
        if (logging) console.log("Applying batch update", batchRecord);
        const deletions = entityIds.filter((id) => isToriiDeleteNotification(batchRecord[id]));
        const upserts = entityIds
          .filter((id) => !isToriiDeleteNotification(batchRecord[id]))
          .map((id) => batchRecord[id]);

        applyBatch({ upserts, deletions });
      } catch (error) {
        console.error("Error processing entity batch:", error);
      }
    }

    isProcessing = false;
    if (updateQueue.length > 0) {
      pendingTimeoutId = setTimeout(processNextInQueue, 0);
    }
  };

  return {
    queueUpdate: (entityId: string, data: ToriiEntity) => {
      updateQueue.push({ entityId, data });
      if (!isProcessing) {
        pendingTimeoutId = setTimeout(processNextInQueue, 200);
      }
    },
    dispose: () => {
      if (pendingTimeoutId !== null) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
      }
      updateQueue.length = 0;
    },
  };
};

const createWorkerQueueProcessor = (
  applyBatch: (batch: BatchPayload) => void,
  logging: boolean,
): QueueProcessor | null => {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  try {
    const manager = new ToriiSyncWorkerManager({
      logging,
      onBatch: (batch) => {
        applyBatch({ upserts: batch.upserts, deletions: batch.deletions });
      },
      onError: (message, error) => {
        console.error("[sync-worker] error", message, error);
      },
    });

    if (!manager.isAvailable) {
      manager.dispose();
      return null;
    }

    return {
      queueUpdate: (_entityId: string, data: ToriiEntity, origin?: "entity" | "event") => {
        manager.enqueue(data, origin ?? "entity");
      },
      dispose: () => manager.dispose(),
    };
  } catch (error) {
    console.error("[sync-worker] failed to initialize", error);
    return null;
  }
};

export const syncEntitiesDebounced = async (
  client: ToriiClient,
  setupResult: SetupResult,
  entityKeyClause: Clause | undefined | null,
  logging = true,
) => {
  if (logging) console.log("Starting syncEntities");

  const {
    network: { world },
  } = setupResult;

  const applyBatch = ({ upserts, deletions }: BatchPayload) => {
    if (deletions.length > 0) {
      deletions.forEach((entityId) => {
        world.deleteEntity(entityId as Entity);
      });
    }

    if (upserts.length > 0) {
      const modelsArray = upserts.map((value) => {
        return { hashed_keys: value.hashed_keys, models: value.models };
      });
      setEntities(modelsArray, world.components, logging);
    }
  };

  const queueProcessor =
    createWorkerQueueProcessor(applyBatch, logging) ?? createMainThreadQueueProcessor(applyBatch, logging);

  const queueUpdate = (data: ToriiEntity, origin: "entity" | "event") => {
    try {
      queueProcessor.queueUpdate(data.hashed_keys, data, origin);
      setupResult.network.provider.recordStreamActivity();
    } catch (error) {
      console.error("Error queuing entity update:", error);
    }
  };

  const entitySub = await client.onEntityUpdated(entityKeyClause, (data: ToriiEntity) => {
    if (logging) console.log("Entity updated", data);
    queueUpdate(data, "entity");
  });

  const eventSub = await client.onEventMessageUpdated(entityKeyClause, (data: ToriiEntity) => {
    if (logging) console.log("Event message updated", data.hashed_keys);
    queueUpdate(data, "event");
  });

  setupResult.network.provider.recordStreamActivity();

  return {
    cancel: () => {
      entitySub.cancel();
      eventSub.cancel();
      queueProcessor.dispose();
    },
  };
};

// initial sync runs before the game is playable and should sync minimal data
type InitialSyncOptions = {
  logging?: boolean;
  reportProgress?: boolean;
};

export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
  options: InitialSyncOptions = {},
) => {
  const { logging = false, reportProgress = true } = options;
  console.log("[STARTING syncEntitiesDebounced]");
  if (entityStreamSubscription) {
    entityStreamSubscription.cancel();
    entityStreamSubscription = null;
  }

  if (reportProgress) {
    setInitialSyncProgress(0);
  }

  entityStreamSubscription = await syncEntitiesDebounced(setup.network.toriiClient, setup, null, logging);

  const contractComponents = setup.network.contractComponents as unknown as Component<Schema, Metadata, undefined>[];

  let highestProgress = reportProgress ? 0 : -1;
  const updateProgress = (value: number) => {
    if (!reportProgress) {
      return;
    }
    if (value <= highestProgress) {
      return;
    }
    highestProgress = value;
    setInitialSyncProgress(value);
  };

  const runTimedTask = async (label: string, targetProgress: number, task: () => Promise<void>) => {
    const start = performance.now();
    await task();
    const end = performance.now();
    console.log(`[sync] ${label}`, end - start);
    updateProgress(targetProgress);
  };

  const parallelTasks: Promise<void>[] = [];

  // BANKS (kicked off immediately so the request overlaps with other sync work)
  parallelTasks.push(
    runTimedTask("bank structures query", 10, async () => {
      await getBankStructuresFromTorii(setup.network.toriiClient, contractComponents);
    }),
  );

  // // SPECTATOR REALM
  const firstNonOwnedStructure = await sqlApi.fetchFirstStructure();

  if (firstNonOwnedStructure) {
    const start = performance.now();
    state.setStructureEntityId(firstNonOwnedStructure.entity_id, {
      spectator: true,
      worldMapPosition: { col: firstNonOwnedStructure.coord_x, row: firstNonOwnedStructure.coord_y },
    });
    await getStructuresDataFromTorii(setup.network.toriiClient, contractComponents, [
      {
        entityId: firstNonOwnedStructure.entity_id,
        position: { col: firstNonOwnedStructure.coord_x, row: firstNonOwnedStructure.coord_y },
      },
    ]);
    const end = performance.now();
    console.log("[sync] first structure query", end - start);
    updateProgress(25);
  }

  await getConfigFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);

  updateProgress(50);

  await getAddressNamesFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  updateProgress(75);

  await getGuildsFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  updateProgress(90);

  await MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi).refresh();

  updateProgress(100);
};

export const resubscribeEntityStream = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
  logging = false,
) => {
  await initialSync(setup, state, setInitialSyncProgress, {
    logging,
    reportProgress: false,
  });
};
