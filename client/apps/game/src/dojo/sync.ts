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
import { getEntities as getEntitiesSnapshot, setEntities } from "@dojoengine/state";
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
import {
  GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODEL_NAMES,
  GLOBAL_SPATIAL_MAP_BOOTSTRAP_SNAPSHOT_MODELS,
} from "./torii-spatial-models";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";
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
  readyOnSubscriptionsReady?: boolean;
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
  cancelGlobalEntityStreamSubscriptions();
};

function cancelGlobalEntityStreamSubscriptions(): void {
  if (entityStreamSubscription) {
    entityStreamSubscription.cancel();
    entityStreamSubscription = null;
  }
}

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

const GLOBAL_EVENT_MODELS: string[] = [
  "s1_eternum-OpenRelicChestEvent",
  "s1_eternum-ExplorerRewardEvent",
  "s1_eternum-BattleEvent",
];

const GLOBAL_EVENT_STREAM_MODELS: GlobalModelStreamConfig[] = GLOBAL_EVENT_MODELS.map((model) => ({ model }));
const BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_MODELS: GlobalModelStreamConfig[] = [
  { model: "s1_eternum-WorldConfig", keyCount: 1 },
  { model: "s1_eternum-HyperstrtConstructConfig", keyCount: 1 },
  { model: "s1_eternum-HyperstructureGlobals", keyCount: 1 },
  { model: "s1_eternum-WeightConfig", keyCount: 1 },
  { model: "s1_eternum-ResourceFactoryConfig", keyCount: 1 },
  { model: "s1_eternum-BuildingCategoryConfig", keyCount: 1 },
  { model: "s1_eternum-ResourceBridgeWtlConfig", keyCount: 1 },
  { model: "s1_eternum-StructureLevelConfig", keyCount: 1 },
  { model: "s1_eternum-SeasonPrize", keyCount: 1 },
  { model: "s1_eternum-SeasonEnded", keyCount: 1 },
  { model: "s1_eternum-QuestLevels", keyCount: 1 },
  { model: "s1_eternum-AddressName", keyCount: 1 },
  { model: "s1_eternum-PlayerRegisteredPoints", keyCount: 1 },
  { model: "s1_eternum-BlitzSettlement", keyCount: 1 },
  { model: "s1_eternum-BlitzEntryTokenRegister", keyCount: 1 },
  { model: "s1_eternum-PlayersRankTrial", keyCount: 1 },
  { model: "s1_eternum-PlayersRankFinal", keyCount: 1 },
  { model: "s1_eternum-MMRGameMeta", keyCount: 1 },
  { model: "s1_eternum-Guild", keyCount: 1 },
  { model: "s1_eternum-GuildMember", keyCount: 1 },
  { model: "s1_eternum-ResourceList", keyCount: 2 },
  { model: "s1_eternum-PlayerRank", keyCount: 2 },
  { model: "s1_eternum-RankPrize", keyCount: 2 },
  { model: "s1_eternum-GuildWhitelist", keyCount: 2 },
];
const GLOBAL_EVENT_STREAM_CLAUSE = buildModelKeysClause(GLOBAL_EVENT_STREAM_MODELS);
const BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_CLAUSE = buildModelKeysClause(BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_MODELS);
const GLOBAL_SPATIAL_MAP_BOOTSTRAP_SNAPSHOT_CLAUSE = buildModelKeysClause(GLOBAL_SPATIAL_MAP_BOOTSTRAP_SNAPSHOT_MODELS);

const getInitialGlobalEntityStreamClause = (): Clause | undefined =>
  env.VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC ? BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_CLAUSE : undefined;

const stringifyWorldmapSyncABPayload = (payload: Record<string, unknown>): string => {
  try {
    return JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  } catch (error) {
    return JSON.stringify({
      serializationError: error instanceof Error ? error.message : String(error),
    });
  }
};

const logWorldmapSyncAB = (message: string, payload: Record<string, unknown>): void => {
  if (env.VITE_PUBLIC_TORII_BOUNDS_DEBUG !== true && env.VITE_PUBLIC_TORII_BOUNDS_DEBUG_OVERLAY !== true) {
    return;
  }

  console.info(`[WorldmapSyncAB] ${message} ${stringifyWorldmapSyncABPayload(payload)}`);
};

const warmMapDataStore = (): void => {
  const mapDataRefreshStart = performance.now();
  void Promise.resolve(MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi).refresh())
    .then(() => {
      recordGameEntryDuration("initial-sync-map-data-refresh", performance.now() - mapDataRefreshStart);
    })
    .catch((error) => {
      console.warn("[sync] MapDataStore warmup failed", error);
    });
};

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
  updateClause?: (clause: SyncSubscriptionClauseInput) => Promise<void>;
}

type SyncSubscriptionClausePair = {
  entityClause?: Clause | null;
  eventClause?: Clause | null;
};

type SyncSubscriptionClauseInput = Clause | undefined | null | SyncSubscriptionClausePair;

type ResolvedSyncSubscriptionClauses = {
  entityClause: Clause | undefined | null;
  eventClause: Clause | undefined | null;
};

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

const createSyncReadinessController = (
  options: { readyOnSubscriptionsReady?: boolean } = {},
): SyncReadinessController => {
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
    const hasRequiredReadySignal = readyEntityUpdateReceived || options.readyOnSubscriptionsReady === true;
    if (settled || !hasRequiredReadySignal || !subscriptionsReady || pendingReadyEntityWrites > 0) {
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

const isSyncSubscriptionClausePair = (input: SyncSubscriptionClauseInput): input is SyncSubscriptionClausePair =>
  typeof input === "object" && input !== null && ("entityClause" in input || "eventClause" in input);

const resolveSyncSubscriptionClauses = (input: SyncSubscriptionClauseInput): ResolvedSyncSubscriptionClauses => {
  if (isSyncSubscriptionClausePair(input)) {
    return {
      entityClause: "entityClause" in input ? input.entityClause : input.eventClause,
      eventClause: "eventClause" in input ? input.eventClause : input.entityClause,
    };
  }

  return {
    entityClause: input,
    eventClause: input,
  };
};

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
  subscriptionClause: SyncSubscriptionClauseInput,
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
  const readiness = createSyncReadinessController({
    readyOnSubscriptionsReady: options?.readyOnSubscriptionsReady,
  });
  const isReadyEntity = options?.isReadyEntity ?? (() => true);
  const initialClauses = resolveSyncSubscriptionClauses(subscriptionClause);

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
        client.onEntityUpdated(initialClauses.entityClause, (data: ToriiEntity) => {
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
        client.onEventMessageUpdated(initialClauses.eventClause, (data: ToriiEntity) => {
          if (logging) console.log("Event message updated", data.hashed_keys);
          queueUpdate(data, "event");
        }),
      subscriptionSetupTimeoutMs: options?.subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout: options?.onSubscriptionSetupTimeout,
    });

    readiness.markSubscriptionsReady();

    // Best-effort runtime close/error detection. torii-wasm exposes none today,
    // so these are no-ops; if a future SDK adds one, a silent stream drop records
    // a close timestamp that classifies the next outage as REMOTE.
    const recordStreamClose = () => useConnectionStore.getState().recordStreamClose();
    const detachLifecycle = [
      observeToriiStreamLifecycle(subscriptions.entitySubscription, recordStreamClose),
      observeToriiStreamLifecycle(subscriptions.eventSubscription, recordStreamClose),
    ];

    const canUpdateSubscriptionClause =
      typeof client.updateEntitySubscription === "function" &&
      typeof client.updateEventMessageSubscription === "function";

    const subscription: SyncEntitiesSubscription = {
      get ready() {
        return readiness.ready;
      },
      cancel: () => {
        detachLifecycle.forEach((detach) => detach());
        subscriptions.cancel();
        queueProcessor.dispose();
        readiness.cancel();
      },
    };

    if (canUpdateSubscriptionClause) {
      subscription.updateClause = async (clause: SyncSubscriptionClauseInput) => {
        const nextClauses = resolveSyncSubscriptionClauses(clause);
        readiness.reset();
        await updateToriiSubscriptions({
          updateEntitySubscription: () =>
            client.updateEntitySubscription(subscriptions.entitySubscription as any, nextClauses.entityClause),
          updateEventSubscription: () =>
            client.updateEventMessageSubscription(subscriptions.eventSubscription as any, nextClauses.eventClause),
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

async function runRequiredToriiOperationWithTimeout<T>(input: {
  label: string;
  operation: () => Promise<T>;
  timeoutMs: number;
  onTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}): Promise<T> {
  const { label, operation, timeoutMs, onTimeout } = input;
  if (!timeoutMs || timeoutMs <= 0) {
    return operation();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      onTimeout?.({ label, timeoutMs });
      reject(new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`));
    }, timeoutMs);

    operation().then(
      (result) => {
        clearTimeout(timeoutId);
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      },
    );
  });
}

async function hydrateGlobalSpatialBootstrapSnapshot(input: {
  setup: SetupResult;
  logging: boolean;
  timeoutMs: number;
  onTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}): Promise<void> {
  const snapshotStart = performance.now();
  try {
    await runRequiredToriiOperationWithTimeout({
      label: "global spatial map bootstrap snapshot",
      timeoutMs: input.timeoutMs,
      onTimeout: input.onTimeout,
      operation: () =>
        getEntitiesSnapshot(
          input.setup.network.toriiClient,
          GLOBAL_SPATIAL_MAP_BOOTSTRAP_SNAPSHOT_CLAUSE,
          input.setup.network.contractComponents as unknown as Component<Schema, Metadata, undefined>[],
          [],
          [...GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODEL_NAMES],
          EVENT_QUERY_LIMIT,
          input.logging,
        ),
    });
  } finally {
    recordGameEntryDuration("initial-sync-global-spatial-map-snapshot", performance.now() - snapshotStart);
  }
}

async function syncGlobalSpatialBootstrapSnapshot(input: {
  setup: SetupResult;
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}): Promise<void> {
  const totalStart = performance.now();
  try {
    await hydrateGlobalSpatialBootstrapSnapshot({
      setup: input.setup,
      logging: input.logging,
      timeoutMs: input.subscriptionSetupTimeoutMs,
      onTimeout: input.onSubscriptionSetupTimeout,
    });
  } finally {
    recordGameEntryDuration("initial-sync-global-spatial-map-sync", performance.now() - totalStart);
  }
}

// initial sync runs before the game is playable and should sync minimal data
type InitialSyncOptions = {
  logging?: boolean;
  reportProgress?: boolean;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  // Re-applies config-derived snapshots (configManager.setDojo) when the
  // session-cached config fast path finishes its background revalidation.
  onConfigRefreshed?: () => void;
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
  cancelGlobalEntityStreamSubscriptions();

  if (reportProgress) {
    setInitialSyncProgress(0);
  }

  isInitialSyncInFlight = true;
  const globalStreamSubscribeStart = performance.now();
  try {
    const initialGlobalEntityClause = getInitialGlobalEntityStreamClause();
    logWorldmapSyncAB("Initial sync config", {
      boundedSpatialSync: env.VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC,
      boundedSpatialPadding: env.VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_PADDING,
      eventModels: GLOBAL_EVENT_MODELS,
      globalEntityMode: initialGlobalEntityClause ? "bounded_global_models" : "legacy_all_entities",
      globalEntityModels: initialGlobalEntityClause
        ? BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_MODELS.map(({ model }) => model)
        : "all",
      spatialBootstrapModels: GLOBAL_SPATIAL_MAP_BOOTSTRAP_MODEL_NAMES,
      timestamp: new Date().toISOString(),
    });
    entityStreamSubscription = await syncEntitiesDebounced(
      setup.network.toriiClient,
      setup,
      {
        entityClause: initialGlobalEntityClause,
        eventClause: GLOBAL_EVENT_STREAM_CLAUSE,
      },
      logging,
      () => useConnectionStore.getState().recordGlobalUpdate(),
      {
        streamType: "global",
        subscriptionSetupTimeoutMs,
        onSubscriptionSetupTimeout: options.onSubscriptionSetupTimeout,
      },
    );
    useConnectionStore.getState().recordGlobalHandshake();

    await syncGlobalSpatialBootstrapSnapshot({
      setup,
      logging,
      subscriptionSetupTimeoutMs,
      onSubscriptionSetupTimeout: options.onSubscriptionSetupTimeout,
    });
    // The global stream remains active for live owner/event updates. Startup
    // only blocks on the spatial snapshot and targeted queries below, because
    // the stream's first entity replay can resolve by timeout on busy worlds.
    // Handshakes are transport freshness. Data freshness is recorded by stream
    // updates, so quiet worlds do not look stale after a successful boot.
    useConnectionStore.getState().recordSpatialHandshake();
  } catch (error) {
    cancelGlobalEntityStreamSubscriptions();
    if (error instanceof Error && error.message.includes("global spatial map")) {
      throw error;
    }
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
      await getConfigFromTorii(
        setup.network.toriiClient,
        setup.network.contractComponents as any,
        options.onConfigRefreshed,
      );
    }),
    runTimedTask("address names query", 75, async () => {
      await getAddressNamesFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
    }),
    runTimedTask("guilds query", 90, async () => {
      await getGuildsFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
    }),
  ]);
  await Promise.all(parallelTasks);

  warmMapDataStore();

  updateProgress(100);
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

/**
 * Lightweight reconnect: re-open ONLY the global entity + event stream.
 *
 * A silently-dropped stream needs its subscription re-created, but the one-time
 * hydration that {@link initialSync} also performs (config, guilds, address
 * names, owned structures, spatial bootstrap snapshot) is already in RECS and
 * does not change across a brief drop — re-running it turns a transient blip
 * into a full re-bootstrap. This re-subscribes the global stream only; spatial
 * recovery is owned by the worldmap recovery handle (onReconnectComplete).
 */
export const resubscribeGlobalEntityStream = async (
  setup: SetupResult,
  options: {
    logging?: boolean;
    subscriptionSetupTimeoutMs?: number;
    onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  } = {},
): Promise<void> => {
  const logging = options.logging ?? false;
  const subscriptionSetupTimeoutMs =
    options.subscriptionSetupTimeoutMs ?? env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS;

  cancelGlobalEntityStreamSubscriptions();
  // Guard the exported cancelEntityStreamSubscription() against tearing down the
  // half-built subscription while we re-handshake.
  isInitialSyncInFlight = true;
  try {
    const initialGlobalEntityClause = getInitialGlobalEntityStreamClause();
    entityStreamSubscription = await syncEntitiesDebounced(
      setup.network.toriiClient,
      setup,
      {
        entityClause: initialGlobalEntityClause,
        eventClause: GLOBAL_EVENT_STREAM_CLAUSE,
      },
      logging,
      () => useConnectionStore.getState().recordGlobalUpdate(),
      {
        streamType: "global",
        subscriptionSetupTimeoutMs,
        onSubscriptionSetupTimeout: options.onSubscriptionSetupTimeout,
      },
    );
    useConnectionStore.getState().recordGlobalHandshake();
  } catch (error) {
    cancelGlobalEntityStreamSubscriptions();
    throw error;
  } finally {
    isInitialSyncInFlight = false;
  }
};
