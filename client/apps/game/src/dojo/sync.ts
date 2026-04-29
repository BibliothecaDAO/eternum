import type { AppStore } from "@/hooks/store/use-ui-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { reportToriiQueuePressure, type NetworkStreamType } from "@/observability/network-health-reporting";
import { type SetupResult } from "@bibliothecadao/dojo";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { sqlApi } from "@/services/api";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import {
  MAP_DATA_REFRESH_INTERVAL,
  MapDataStore,
  recordArmyMovementLatencyPhase,
  tileOptToTile,
} from "@bibliothecadao/eternum";
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
import { env } from "../../env";
import { resolveInitialStructureSelection } from "./sync-initial-selection";
import { isDeletionPayload } from "./sync-utils";
import { ToriiSyncWorkerManager } from "./sync-worker-manager";
import { buildModelKeysClause, type GlobalModelStreamConfig } from "./torii-stream-manager";
import {
  setupToriiSubscriptions,
  updateToriiSubscriptions,
  type ToriiSubscriptionSetupTimeoutInfo,
} from "./torii-subscription-setup";

export const EVENT_QUERY_LIMIT = 40_000;
const TORII_SYNC_WORKER_QUEUE_WARNING_THRESHOLD = 500;

interface SyncEntitiesSubscriptionOptions {
  isReadyEntity?: SyncEntityReadinessMatcher;
  onReadyEntityApplied?: (info: SyncEntityReadinessInfo) => void;
  onReadyEntityReceived?: (info: SyncEntityReadinessInfo) => void;
  streamType?: NetworkStreamType;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}

let entityStreamSubscription: { cancel: () => void; ready: Promise<void> } | null = null;
let isInitialSyncInFlight = false;

/**
 * Cancel the global entity stream subscription.
 * Used during game switching to stop the old Torii client from writing
 * stale data into RECS while the new world is being bootstrapped.
 *
 * No-op while a boot is still handshaking — tearing down a half-built
 * subscription strands RECS and the monitor then re-enters the same loop.
 */
export const cancelEntityStreamSubscription = () => {
  if (isInitialSyncInFlight) return;
  if (entityStreamSubscription) {
    entityStreamSubscription.cancel();
    entityStreamSubscription = null;
  }
};

function toTraceBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

function recordTileOptStreamTrace(data: ToriiEntity): void {
  const tileOptModel = (data.models as Record<string, unknown>)["s1_eternum-TileOpt"];
  if (!tileOptModel || typeof tileOptModel !== "object") {
    return;
  }

  const tileOptRecord = tileOptModel as Record<string, unknown>;
  const tileData = toTraceBigInt(tileOptRecord.data);
  if (tileData === null) {
    return;
  }

  try {
    const tile = tileOptToTile({
      alt: Boolean(tileOptRecord.alt),
      col: Number(tileOptRecord.col ?? 0),
      row: Number(tileOptRecord.row ?? 0),
      data: tileData,
    });

    recordArmyMovementLatencyPhase({
      phase: "tileopt_stream_received",
      source: "torii_sync",
      entityId: typeof tile.occupier_id === "number" ? tile.occupier_id : undefined,
      tileEntityKey: data.hashed_keys,
      details: {
        col: tile.col,
        row: tile.row,
        occupierType: tile.occupier_type,
      },
    });
  } catch {
    recordArmyMovementLatencyPhase({
      phase: "tileopt_stream_received",
      source: "torii_sync",
      tileEntityKey: data.hashed_keys,
    });
  }
}

const GLOBAL_NON_SPATIAL_MODELS: string[] = [
  // Events
  "s1_eternum-OpenRelicChestEvent",
  // Guilds
  "s1_eternum-Guild",
  "s1_eternum-GuildMember",
  "s1_eternum-GuildWhitelist",
  // Market
  "s1_eternum-Market",
  "s1_eternum-Liquidity",
  "s1_eternum-Trade",
  // Config + global metadata
  "s1_eternum-WorldConfig",
  "s1_eternum-HyperstrtConstructConfig",
  "s1_eternum-HyperstructureGlobals",
  "s1_eternum-WeightConfig",
  "s1_eternum-ResourceFactoryConfig",
  "s1_eternum-BuildingCategoryConfig",
  "s1_eternum-StructureLevelConfig",
  "s1_eternum-SeasonEnded",
  "s1_eternum-QuestLevels",
  "s1_eternum-AddressName",
  "s1_eternum-PlayerRegisteredPoints",
  "s1_eternum-BlitzRealmPlayerRegister",
  "s1_eternum-BlitzRealmSettleFinish",
  "s1_eternum-PlayersRankTrial",
  "s1_eternum-PlayersRankFinal",
  "s1_eternum-ResourceList",
  "s1_eternum-PlayerRank",
  "s1_eternum-RankPrize",
];

// Models synced per-player via a scoped subscription (see usePlayerStructureSync)
const PLAYER_STRUCTURE_MODELS: string[] = [
  "s1_eternum-ProductionBoostBonus",
  "s1_eternum-Resource",
  "s1_eternum-ResourceArrival",
];

const GLOBAL_STREAM_MODELS: GlobalModelStreamConfig[] = GLOBAL_NON_SPATIAL_MODELS.map((model) => ({ model }));
const GLOBAL_STREAM_CLAUSE = buildModelKeysClause(GLOBAL_STREAM_MODELS);

type BatchPayload = { upserts: ToriiEntity[]; deletions: string[] };
type SyncEntityReadinessMatcher = (data: ToriiEntity) => boolean;
type SyncEntityReadinessInfo = {
  entityId: string;
  models: string[];
};

interface QueueProcessor {
  queueUpdate: (entityId: string, data: ToriiEntity, origin?: "entity" | "event") => Promise<void>;
  dispose: () => void;
}

interface SyncEntitiesSubscription {
  cancel: () => void;
  ready: Promise<void>;
  updateClause?: (clause: Clause | undefined | null) => Promise<void>;
}

interface SyncReadinessController {
  ready: Promise<void>;
  trackReadyEntityWrite: (writeComplete: Promise<void>) => void;
  markSubscriptionsReady: () => void;
  reset: () => void;
  cancel: () => void;
}

interface WriteCompletionTracker {
  track: (entityId: string) => Promise<void>;
  resolveBatch: (batch: BatchPayload) => void;
  resolveAll: () => void;
}

type QueuedUpdate = { entityId: string; data: ToriiEntity; resolve: () => void };

const createSyncReadinessController = (): SyncReadinessController => {
  let readyEntityUpdateReceived = false;
  let subscriptionsReady = false;
  let pendingReadyEntityWrites = 0;
  let settled = false;

  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let ready: Promise<void>;

  const createReadyPromise = () => {
    readyEntityUpdateReceived = false;
    subscriptionsReady = false;
    pendingReadyEntityWrites = 0;
    settled = false;
    ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    ready.catch(() => undefined);
  };

  createReadyPromise();

  const resolveWhenReadyEntitiesAreApplied = () => {
    if (settled || !readyEntityUpdateReceived || !subscriptionsReady || pendingReadyEntityWrites > 0) {
      return;
    }

    settled = true;
    resolveReady();
  };

  return {
    get ready() {
      return ready;
    },
    trackReadyEntityWrite: (writeComplete: Promise<void>) => {
      readyEntityUpdateReceived = true;
      pendingReadyEntityWrites += 1;
      writeComplete.then(
        () => {
          pendingReadyEntityWrites -= 1;
          resolveWhenReadyEntitiesAreApplied();
        },
        () => {
          pendingReadyEntityWrites -= 1;
          resolveWhenReadyEntitiesAreApplied();
        },
      );
    },
    markSubscriptionsReady: () => {
      subscriptionsReady = true;
      resolveWhenReadyEntitiesAreApplied();
    },
    reset: () => {
      if (!settled) {
        rejectReady(new Error("syncEntitiesDebounced readiness reset before ready"));
      }
      createReadyPromise();
    },
    cancel: () => {
      if (settled) {
        return;
      }

      settled = true;
      rejectReady(new Error("syncEntitiesDebounced canceled before ready"));
    },
  };
};

const createSyncEntityReadinessInfo = (data: ToriiEntity): SyncEntityReadinessInfo => ({
  entityId: data.hashed_keys,
  models: Object.keys((data.models as Record<string, unknown>) ?? {}),
});

const createWriteCompletionTracker = (): WriteCompletionTracker => {
  const pendingWriteResolvers = new Map<string, Array<() => void>>();

  const resolveEntityWrites = (entityId: string) => {
    const resolvers = pendingWriteResolvers.get(entityId);
    if (!resolvers) {
      return;
    }

    resolvers.forEach((resolve) => resolve());
    pendingWriteResolvers.delete(entityId);
  };

  return {
    track: (entityId: string) =>
      new Promise<void>((resolve) => {
        const resolvers = pendingWriteResolvers.get(entityId) ?? [];
        resolvers.push(resolve);
        pendingWriteResolvers.set(entityId, resolvers);
      }),
    resolveBatch: (batch: BatchPayload) => {
      const appliedEntityIds = new Set([...batch.deletions, ...batch.upserts.map((entity) => entity.hashed_keys)]);
      appliedEntityIds.forEach(resolveEntityWrites);
    },
    resolveAll: () => {
      pendingWriteResolvers.forEach((resolvers) => {
        resolvers.forEach((resolve) => resolve());
      });
      pendingWriteResolvers.clear();
    },
  };
};

const createMainThreadQueueProcessor = (
  applyBatch: (batch: BatchPayload) => void,
  logging: boolean,
): QueueProcessor => {
  const updateQueue: QueuedUpdate[] = [];
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
      const isEntityDelete = isDeletionPayload(data);
      if (isEntityDelete) {
        batchRecord[entityId] = data;
      }
      if (batchRecord[entityId]) {
        const entityHasBeenDeleted = isDeletionPayload(batchRecord[entityId]);
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
        const deletions = entityIds.filter((id) => isDeletionPayload(batchRecord[id]));
        const upserts = entityIds.filter((id) => !isDeletionPayload(batchRecord[id])).map((id) => batchRecord[id]);

        applyBatch({ upserts, deletions });
      } catch (error) {
        console.error("Error processing entity batch:", error);
      }
    }

    itemsToProcess.forEach(({ resolve }) => resolve());

    isProcessing = false;
    if (updateQueue.length > 0) {
      pendingTimeoutId = setTimeout(processNextInQueue, 0);
    }
  };

  return {
    queueUpdate: (entityId: string, data: ToriiEntity) => {
      const writeComplete = new Promise<void>((resolve) => {
        updateQueue.push({ entityId, data, resolve });
      });
      if (!isProcessing) {
        if (pendingTimeoutId !== null) clearTimeout(pendingTimeoutId);
        pendingTimeoutId = setTimeout(processNextInQueue, 200);
      }
      return writeComplete;
    },
    dispose: () => {
      if (pendingTimeoutId !== null) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
      }
      updateQueue.forEach(({ resolve }) => resolve());
      updateQueue.length = 0;
    },
  };
};

const createWorkerQueueProcessor = (
  applyBatch: (batch: BatchPayload) => void,
  logging: boolean,
  streamType: NetworkStreamType,
): QueueProcessor | null => {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  try {
    const writeCompletion = createWriteCompletionTracker();

    const manager = new ToriiSyncWorkerManager({
      logging,
      onBatch: (batch) => {
        const syncBatch = { upserts: batch.upserts, deletions: batch.deletions };
        applyBatch(syncBatch);
        writeCompletion.resolveBatch(syncBatch);
        reportToriiQueuePressure({
          streamType,
          queueSize: batch.queueSize,
          batchSize: batch.upserts.length + batch.deletions.length,
          threshold: TORII_SYNC_WORKER_QUEUE_WARNING_THRESHOLD,
        });
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
        const writeComplete = writeCompletion.track(data.hashed_keys);
        if (!manager.enqueue(data, origin ?? "entity")) {
          writeCompletion.resolveAll();
        }
        return writeComplete;
      },
      dispose: () => {
        writeCompletion.resolveAll();
        manager.dispose();
      },
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
  onUpdate?: () => void,
  options?: SyncEntitiesSubscriptionOptions,
): Promise<SyncEntitiesSubscription> => {
  if (logging) console.log("Starting syncEntities");

  const {
    network: { world },
  } = setupResult;

  const applyBatch = ({ upserts, deletions }: BatchPayload) => {
    if (deletions.length > 0) {
      deletions.forEach((entityId) => {
        try {
          world.deleteEntity(entityId as Entity);
        } catch (error) {
          console.error("[sync] failed to delete entity", entityId, error);
        }
      });
    }

    if (upserts.length > 0) {
      const modelsArray = upserts.map((value) => {
        return { hashed_keys: value.hashed_keys, models: value.models };
      });
      try {
        setEntities(modelsArray, world.components, logging);
      } catch (error) {
        console.error("[sync] failed to apply entity upserts", error);
      }
    }
  };

  const streamType = options?.streamType ?? "global";
  const queueProcessor =
    createWorkerQueueProcessor(applyBatch, logging, streamType) ?? createMainThreadQueueProcessor(applyBatch, logging);
  const readiness = createSyncReadinessController();
  const isReadyEntity = options?.isReadyEntity ?? (() => true);

  const queueUpdate = (data: ToriiEntity, origin: "entity" | "event") => {
    try {
      const writeComplete = queueProcessor.queueUpdate(data.hashed_keys, data, origin);
      onUpdate?.();
      return writeComplete;
    } catch (error) {
      console.error("Error queuing entity update:", error);
      return Promise.resolve();
    }
  };

  try {
    const subscriptions = await setupToriiSubscriptions({
      createEntitySubscription: () =>
        client.onEntityUpdated(entityKeyClause, (data: ToriiEntity) => {
          if (logging) console.log("Entity updated", data);
          recordTileOptStreamTrace(data);
          const writeComplete = queueUpdate(data, "entity");
          if (isReadyEntity(data)) {
            const readyEntityInfo = createSyncEntityReadinessInfo(data);
            options?.onReadyEntityReceived?.(readyEntityInfo);
            void writeComplete.finally(() => {
              options?.onReadyEntityApplied?.(readyEntityInfo);
            });
            readiness.trackReadyEntityWrite(writeComplete);
          }
        }),
      createEventSubscription: () =>
        client.onEventMessageUpdated(entityKeyClause, (data: ToriiEntity) => {
          if (logging) console.log("Event message updated", data.hashed_keys);
          queueUpdate(data, "event");
        }),
      subscriptionSetupTimeoutMs: options?.subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout: options?.onSubscriptionSetupTimeout,
    });

    readiness.markSubscriptionsReady();

    const canUpdateSubscriptionClause =
      typeof client.updateEntitySubscription === "function" &&
      typeof client.updateEventMessageSubscription === "function";

    const subscription: SyncEntitiesSubscription = {
      get ready() {
        return readiness.ready;
      },
      cancel: () => {
        subscriptions.cancel();
        queueProcessor.dispose();
        readiness.cancel();
      },
    };

    if (canUpdateSubscriptionClause) {
      subscription.updateClause = async (clause: Clause | undefined | null) => {
        readiness.reset();
        await updateToriiSubscriptions({
          updateEntitySubscription: () =>
            client.updateEntitySubscription(subscriptions.entitySubscription as any, clause),
          updateEventSubscription: () =>
            client.updateEventMessageSubscription(subscriptions.eventSubscription as any, clause),
          subscriptionSetupTimeoutMs: options?.subscriptionSetupTimeoutMs,
          onSubscriptionSetupTimeout: options?.onSubscriptionSetupTimeout,
        });
        readiness.markSubscriptionsReady();
      };
    }

    return subscription;
  } catch (error) {
    queueProcessor.dispose();
    throw error;
  }
};

// initial sync runs before the game is playable and should sync minimal data
type InitialSyncOptions = {
  logging?: boolean;
  reportProgress?: boolean;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
};

export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
  options: InitialSyncOptions = {},
) => {
  const { logging = false, reportProgress = true } = options;
  const subscriptionSetupTimeoutMs =
    options.subscriptionSetupTimeoutMs ?? env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS;
  console.log("[STARTING syncEntitiesDebounced]");
  if (entityStreamSubscription) {
    entityStreamSubscription.cancel();
    entityStreamSubscription = null;
  }

  if (reportProgress) {
    setInitialSyncProgress(0);
  }

  isInitialSyncInFlight = true;
  const globalStreamSubscribeStart = performance.now();
  try {
    entityStreamSubscription = await syncEntitiesDebounced(
      setup.network.toriiClient,
      setup,
      GLOBAL_STREAM_CLAUSE,
      logging,
      () => useConnectionStore.getState().recordGlobalUpdate(),
      {
        streamType: "global",
        subscriptionSetupTimeoutMs,
        onSubscriptionSetupTimeout: options.onSubscriptionSetupTimeout,
      },
    );
    // Handshake succeeded; data freshness is recorded separately from
    // subscription transport freshness so quiet worlds do not look stale.
    useConnectionStore.getState().recordGlobalHandshake();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timed out waiting for")) {
      throw new Error(`Timed out connecting to the world stream after ${subscriptionSetupTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    recordGameEntryDuration("initial-sync-global-stream-subscribe", performance.now() - globalStreamSubscribeStart);
    isInitialSyncInFlight = false;
  }

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
    const elapsedMs = performance.now() - start;
    console.log(`[sync] ${label}`, elapsedMs);
    // Surface in the boot debug panel under a deterministic key so a slow
    // sub-step (e.g. "guilds query") immediately points at the bottleneck
    // instead of being hidden inside the aggregate `initial-sync` total.
    recordGameEntryDuration(`initial-sync-${label.replace(/\s+/g, "-")}`, elapsedMs);
    updateProgress(targetProgress);
  };

  const parallelTasks: Promise<void>[] = [];

  // BANKS (kicked off immediately so the request overlaps with other sync work)
  parallelTasks.push(
    runTimedTask("bank structures query", 10, async () => {
      await getBankStructuresFromTorii(setup.network.toriiClient, contractComponents);
    }),
  );

  // Initial structure selection:
  // 1) connected players: first owned realm (fallback: first owned structure)
  // 2) spectators / no owned structures: first global structure
  const currentStructureEntityId = state.structureEntityId;
  if (!currentStructureEntityId || currentStructureEntityId === 0) {
    const accountAddress = useAccountStore.getState().account?.address;
    const hasConnectedAccount =
      typeof accountAddress === "string" && accountAddress.length > 0 && accountAddress !== "0x0";

    let ownedStructures: Array<{ entity_id: number; coord_x: number; coord_y: number; category?: number | string }> =
      [];

    if (hasConnectedAccount) {
      try {
        ownedStructures = await sqlApi.fetchPlayerStructures(accountAddress);
      } catch (error) {
        console.error("[sync] Failed to fetch player-owned structures for initial selection", error);
      }
    }

    const firstGlobalStructure = ownedStructures.length === 0 ? await sqlApi.fetchFirstStructure() : null;
    const { selectedStructure, spectator: selectAsSpectator } = resolveInitialStructureSelection({
      ownedStructures,
      firstGlobalStructure,
    });

    if (selectedStructure) {
      const start = performance.now();
      state.setStructureEntityId(selectedStructure.entity_id, {
        spectator: selectAsSpectator,
        worldMapPosition: { col: selectedStructure.coord_x, row: selectedStructure.coord_y },
      });
      await getStructuresDataFromTorii(setup.network.toriiClient, contractComponents, [
        {
          entityId: selectedStructure.entity_id,
          position: { col: selectedStructure.coord_x, row: selectedStructure.coord_y },
        },
      ]);
      const end = performance.now();
      console.log("[sync] initial structure query", end - start);
      updateProgress(25);
    }
  } else {
    updateProgress(25);
  }

  // Config, AddressNames and Guilds write to disjoint components with no
  // ordering constraints, so run them concurrently. updateProgress keeps the
  // highest value, so individual checkpoints are safe in any order.
  await Promise.all([
    runTimedTask("config query", 50, async () => {
      await getConfigFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
    }),
    runTimedTask("address names query", 75, async () => {
      await getAddressNamesFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
    }),
    runTimedTask("guilds query", 90, async () => {
      await getGuildsFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
    }),
  ]);

  const mapDataRefreshStart = performance.now();
  await MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi).refresh();
  recordGameEntryDuration("initial-sync-map-data-refresh", performance.now() - mapDataRefreshStart);

  // Block on the Torii stream's initial entity flush so the worldmap scene
  // observes populated RECS state instead of an empty world on fast loads.
  if (entityStreamSubscription) {
    const flushStart = performance.now();
    await waitForInitialEntityFlush(entityStreamSubscription.ready, subscriptionSetupTimeoutMs);
    recordGameEntryDuration("initial-sync-initial-entity-flush", performance.now() - flushStart);
  }

  updateProgress(100);
};

const waitForInitialEntityFlush = async (ready: Promise<void>, timeoutMs: number): Promise<void> => {
  const flushStart = performance.now();
  const readyPromise = ready.catch((error) => {
    console.warn("[sync] Initial entity flush did not settle cleanly", error);
  });

  if (!timeoutMs || timeoutMs <= 0) {
    await readyPromise;
    console.log("[sync] initial entity flush", performance.now() - flushStart);
    return;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`[sync] Initial entity flush timed out after ${timeoutMs}ms, continuing`);
      resolve();
    }, timeoutMs);
  });

  await Promise.race([readyPromise, timeoutPromise]);
  if (timeoutHandle !== undefined) {
    clearTimeout(timeoutHandle);
  }
  console.log("[sync] initial entity flush", performance.now() - flushStart);
};

const resubscribeEntityStream = async (
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
