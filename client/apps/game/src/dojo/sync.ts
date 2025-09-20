import type { AppStore } from "@/hooks/store/use-ui-store";
import { type SetupResult } from "@bibliothecadao/dojo";

import { sqlApi } from "@/services/api";
import { MAP_DATA_REFRESH_INTERVAL, MapDataStore } from "@bibliothecadao/eternum";
import {
  attachSyncDebug,
  type SyncGuardState,
  type SyncLedgerSnapshotOptions,
} from "../../../../../common/dojo/sync-debug";
import type { Entity, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, ToriiClient, Entity as ToriiEntity, Model, Ty } from "@dojoengine/torii-wasm/types";
import {
  getAddressNamesFromTorii,
  getBankStructuresFromTorii,
  getConfigFromTorii,
  getGuildsFromTorii,
  getStructuresDataFromTorii,
} from "./queries";

export const EVENT_QUERY_LIMIT = 40_000;

function isToriiDeleteNotification(entity: ToriiEntity): boolean {
  return Object.keys(entity.models).length === 0;
}

type EntityLedgerEntry = {
  blockNumber?: bigint;
  eventIndex?: number;
  isDeleted: boolean;
  components: Map<string, bigint>;
};

type QueuedEntityUpdate = {
  entityId: string;
  raw: ToriiEntity & {
    block_number?: string | number;
    event_index?: string | number;
  };
  blockNumber?: bigint;
  eventIndex?: number;
  componentTimestamps: Record<string, bigint>;
  isDelete: boolean;
};

const BLOCK_NUMBER_KEYS = ["block_number", "blockNumber", "blk_num"] as const;
const EVENT_INDEX_KEYS = ["event_index", "eventIndex", "evt_idx"] as const;

interface SyncGuardConfig {
  heartbeatTimeoutMs: number;
  heartbeatCheckIntervalMs: number;
  maxReplayAttempts: number;
  replayPageLimit: number;
}

interface SyncGuardOptions {
  logging?: boolean;
  guard?: Partial<SyncGuardConfig>;
  onStateChange?: (state: SyncGuardState) => void;
  debugId?: string;
  debugEnabled?: boolean;
}

const DEFAULT_GUARD_CONFIG: SyncGuardConfig = {
  heartbeatTimeoutMs: 30_000,
  heartbeatCheckIntervalMs: 5_000,
  maxReplayAttempts: 3,
  replayPageLimit: EVENT_QUERY_LIMIT,
};

class SyncGuard {
  private state: SyncGuardState = "streaming";
  private checkTimer: NodeJS.Timeout | null = null;
  private lastAppliedAt = Date.now();
  private lastAppliedBlock?: bigint;
  private isReplaying = false;
  private replayAttempts = 0;
  private replayAckDeferred?: {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  };

  constructor(
    private readonly deps: {
      client: ToriiClient;
      clause: Clause | undefined | null;
      queueUpdate: (entityId: string, data: ToriiEntity) => void;
      logging: boolean;
      config: SyncGuardConfig;
      onStateChange?: (state: SyncGuardState) => void;
      resubscribe: () => Promise<void>;
    },
  ) {}

  start() {
    this.stop();
    this.checkTimer = setInterval(() => {
      void this.checkHeartbeat();
    }, this.deps.config.heartbeatCheckIntervalMs);
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.clearReplayAck("stopped");
  }

  getState(): SyncGuardState {
    return this.state;
  }

  async forceReplay() {
    await this.triggerReplay(true);
  }

  getSnapshot() {
    return {
      state: this.state,
      lastAppliedAt: this.lastAppliedAt,
      lastAppliedBlock: this.lastAppliedBlock,
      isReplaying: this.isReplaying,
      replayAttempts: this.replayAttempts,
    };
  }

  notifyUpdate(updates: QueuedEntityUpdate[]) {
    if (updates.length === 0) return;

    this.lastAppliedAt = Date.now();
    this.replayAttempts = 0;

    for (const update of updates) {
      if (update.blockNumber !== undefined) {
        if (!this.lastAppliedBlock || update.blockNumber > this.lastAppliedBlock) {
          this.lastAppliedBlock = update.blockNumber;
        }
      }
    }

    if (this.state !== "streaming") {
      this.setState("streaming");
    }

    if (this.replayAckDeferred) {
      this.resolveReplayAck();
    }
  }

  private async checkHeartbeat() {
    if (this.isReplaying) return;

    const elapsed = Date.now() - this.lastAppliedAt;
    if (elapsed < this.deps.config.heartbeatTimeoutMs) {
      return;
    }

    if (this.state !== "lagging" && this.state !== "replaying") {
      this.setState("lagging");
    }

    await this.triggerReplay(false);
  }

  private async triggerReplay(manual: boolean) {
    if (this.isReplaying) {
      if (this.deps.logging) console.warn("[sync-guard] Replay already in progress");
      return;
    }

    this.isReplaying = true;
    this.replayAttempts += 1;
    this.setState("replaying");

    const ackPromise = this.createReplayAckPromise();

    try {
      await this.deps.resubscribe();

      let cursor: string | undefined = undefined;
      let totalItems = 0;

      do {
        const response = await this.deps.client.getEntities({
          clause: this.deps.clause === null ? undefined : this.deps.clause,
          pagination: {
            limit: this.deps.config.replayPageLimit,
            cursor,
            direction: "Forward",
            order_by: [],
          },
          no_hashed_keys: false,
          models: [],
          historical: false,
        });

        for (const item of response.items) {
          this.deps.queueUpdate(item.hashed_keys, item as ToriiEntity);
        }

        totalItems += response.items.length;
        cursor = response.next_cursor;
      } while (cursor);

      if (totalItems === 0) {
        this.resolveReplayAck();
      }

      await ackPromise;

      this.replayAttempts = 0;
      this.lastAppliedAt = Date.now();
      this.setState("streaming");
    } catch (error) {
      if (this.deps.logging) {
        console.error("[sync-guard] Replay failed", error);
      }

      if (this.replayAttempts >= this.deps.config.maxReplayAttempts && !manual) {
        this.setState("error");
      } else {
        this.setState("lagging");
      }
      if (this.replayAckDeferred) {
        this.rejectReplayAck(error instanceof Error ? error : new Error("Replay failed"));
      }
    } finally {
      this.isReplaying = false;
      this.clearReplayAck();
    }
  }

  private setState(state: SyncGuardState) {
    if (this.state === state) return;
    this.state = state;
    if (this.deps.logging) {
      console.log(`[sync-guard] state -> ${state}`);
    }
    this.deps.onStateChange?.(state);
  }

  private createReplayAckPromise(): Promise<void> {
    this.clearReplayAck();

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.replayAckDeferred = undefined;
        reject(new Error("Replay acknowledgement timed out"));
      }, this.deps.config.heartbeatTimeoutMs);

      this.replayAckDeferred = {
        resolve: () => {
          clearTimeout(timer);
          this.replayAckDeferred = undefined;
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          this.replayAckDeferred = undefined;
          reject(error);
        },
        timer,
      };
    });
  }

  private resolveReplayAck() {
    const deferred = this.replayAckDeferred;
    if (!deferred) return;
    deferred.resolve();
  }

  private rejectReplayAck(error: Error) {
    const deferred = this.replayAckDeferred;
    if (!deferred) return;
    deferred.reject(error);
  }

  private clearReplayAck(reason?: string) {
    if (!this.replayAckDeferred) return;
    clearTimeout(this.replayAckDeferred.timer);
    if (reason && this.deps.logging) {
      console.log(`[sync-guard] clearing replay ack (${reason})`);
    }
    this.replayAckDeferred = undefined;
  }
}

const toBigIntOrUndefined = (value: unknown): bigint | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    if (value.trim() === "") return undefined;
    try {
      return value.startsWith("0x") ? BigInt(value) : BigInt(value);
    } catch (error) {
      console.warn("[sync] Unable to parse bigint value", value, error);
      return undefined;
    }
  }
  return undefined;
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const extractBlockNumber = (data: unknown): bigint | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;

  for (const key of BLOCK_NUMBER_KEYS) {
    const maybe = toBigIntOrUndefined(record?.[key]);
    if (maybe !== undefined) return maybe;
  }
  const metadata = record?.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    for (const key of BLOCK_NUMBER_KEYS) {
      const maybe = toBigIntOrUndefined(metadata?.[key]);
      if (maybe !== undefined) return maybe;
    }
  }
  return undefined;
};

const extractEventIndex = (data: unknown): number | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;

  for (const key of EVENT_INDEX_KEYS) {
    const maybe = toNumberOrUndefined(record?.[key]);
    if (maybe !== undefined) return maybe;
  }
  const metadata = record?.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    for (const key of EVENT_INDEX_KEYS) {
      const maybe = toNumberOrUndefined(metadata?.[key]);
      if (maybe !== undefined) return maybe;
    }
  }
  return undefined;
};

const extractBigIntFromTy = (ty: Ty | undefined): bigint | undefined => {
  if (!ty) return undefined;
  const { value } = ty;
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && "option" in value) {
    return extractBigIntFromTy((value as { value: Ty }).value);
  }
  return toBigIntOrUndefined(value);
};

const extractComponentTimestamps = (models: Record<string, Model>): Record<string, bigint> => {
  return Object.entries(models).reduce<Record<string, bigint>>((acc, [componentName, model]) => {
    const timestamp = extractBigIntFromTy(model?.last_updated_at as Ty | undefined);
    if (timestamp !== undefined) {
      acc[componentName] = timestamp;
    }
    return acc;
  }, {});
};

const getMaxTimestamp = (timestamps: Record<string, bigint>): bigint | undefined => {
  const values = Object.values(timestamps);
  if (values.length === 0) return undefined;
  return values.reduce((max, current) => (current > max ? current : max));
};

const compareBigInt = (a?: bigint, b?: bigint): number => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  if (a === b) return 0;
  return a > b ? 1 : -1;
};

const compareNumber = (a?: number, b?: number): number => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  if (a === b) return 0;
  return a > b ? 1 : -1;
};

const isIncomingUpdateNewer = (incoming: QueuedEntityUpdate, existing: QueuedEntityUpdate): boolean => {
  const blockComparison = compareBigInt(incoming.blockNumber, existing.blockNumber);
  if (blockComparison !== 0) return blockComparison > 0;

  const eventComparison = compareNumber(incoming.eventIndex, existing.eventIndex);
  if (eventComparison !== 0) return eventComparison > 0;

  const existingTimestamps = existing.componentTimestamps;
  const incomingTimestamps = incoming.componentTimestamps;

  // If incoming introduces a new component timestamp, treat as newer.
  for (const componentName of Object.keys(incomingTimestamps)) {
    if (!(componentName in existingTimestamps)) {
      return true;
    }
  }

  const incomingMax = getMaxTimestamp(incomingTimestamps);
  const existingMax = getMaxTimestamp(existingTimestamps);
  const timestampComparison = compareBigInt(incomingMax, existingMax);
  if (timestampComparison !== 0) return timestampComparison > 0;

  if (incoming.isDelete && !existing.isDelete) return true;

  return false;
};

const extractQueuedUpdate = (entityId: string, data: ToriiEntity): QueuedEntityUpdate => {
  const raw = data as QueuedEntityUpdate["raw"];
  const componentTimestamps = extractComponentTimestamps(data.models ?? {});
  const blockNumber = extractBlockNumber(raw);
  const eventIndex = extractEventIndex(raw);

  return {
    entityId,
    raw,
    blockNumber,
    eventIndex,
    componentTimestamps,
    isDelete: isToriiDeleteNotification(data),
  };
};

const shouldApplyUpdate = (
  entityId: string,
  update: QueuedEntityUpdate,
  ledger: Map<string, EntityLedgerEntry>,
): boolean => {
  const ledgerEntry = ledger.get(entityId);
  if (!ledgerEntry) return true;

  const blockComparison = compareBigInt(update.blockNumber, ledgerEntry.blockNumber);
  if (blockComparison > 0) return true;
  if (blockComparison < 0) return false;

  const eventComparison = compareNumber(update.eventIndex, ledgerEntry.eventIndex);
  if (eventComparison > 0) return true;
  if (eventComparison < 0) return false;

  for (const [componentName, timestamp] of Object.entries(update.componentTimestamps)) {
    const ledgerTimestamp = ledgerEntry.components.get(componentName);
    if (ledgerTimestamp === undefined) {
      return true;
    }
    if (timestamp > ledgerTimestamp) {
      return true;
    }
  }

  if (update.isDelete && !ledgerEntry.isDeleted) {
    return true;
  }

  // If we have no metadata to compare, err on the side of applying.
  if (
    update.blockNumber === undefined &&
    update.eventIndex === undefined &&
    Object.keys(update.componentTimestamps).length === 0
  ) {
    return true;
  }

  return false;
};

const updateLedger = (
  entityId: string,
  update: QueuedEntityUpdate,
  ledger: Map<string, EntityLedgerEntry>,
) => {
  const entry: EntityLedgerEntry = ledger.get(entityId) ?? {
    blockNumber: undefined,
    eventIndex: undefined,
    isDeleted: false,
    components: new Map(),
  };

  if (update.blockNumber !== undefined) {
    entry.blockNumber = update.blockNumber;
  }
  if (update.eventIndex !== undefined) {
    entry.eventIndex = update.eventIndex;
  }

  if (update.isDelete) {
    entry.isDeleted = true;
    entry.components.clear();
  } else {
    entry.isDeleted = false;
    for (const [componentName, timestamp] of Object.entries(update.componentTimestamps)) {
      entry.components.set(componentName, timestamp);
    }
  }

  ledger.set(entityId, entry);
};

const syncEntitiesDebounced = async <S extends Schema>(
  client: ToriiClient,
  setupResult: SetupResult,
  entityKeyClause: Clause | undefined | null,
  loggingOrOptions: boolean | SyncGuardOptions = false,
) => {
  const options = typeof loggingOrOptions === "boolean" ? { logging: loggingOrOptions } : loggingOrOptions ?? {};
  const logging = options.logging ?? false;
  const guardConfig: SyncGuardConfig = { ...DEFAULT_GUARD_CONFIG, ...options.guard };
  const onStateChange = options.onStateChange;
  const debugEnabled = options.debugEnabled ?? (typeof window !== "undefined" ? import.meta.env.DEV : false);
  const debugId = options.debugId ?? "torii-sync";

  if (logging) console.log("Starting syncEntities");

  const ledger = new Map<string, EntityLedgerEntry>();
  const queuedUpdates = new Map<string, QueuedEntityUpdate>();
  const pendingEntityIds: string[] = [];
  const pendingEntityIdSet = new Set<string>();
  let guard: SyncGuard | null = null;
  let debugDetach: (() => void) | undefined;
  let isProcessing = false;
  const BATCH_SIZE = 10;

  const {
    network: { world },
  } = setupResult;

  // Function to process the next item in the queue
  const processNextInQueue = async () => {
    if (pendingEntityIds.length === 0 || isProcessing) return;

    isProcessing = true;

    while (pendingEntityIds.length > 0) {
      const batch: Record<string, ToriiEntity> = {};
      const appliedUpdates: Array<{ entityId: string; update: QueuedEntityUpdate }> = [];
      let processedCount = 0;

      while (pendingEntityIds.length > 0 && processedCount < BATCH_SIZE) {
        const entityId = pendingEntityIds.shift() as string;
        pendingEntityIdSet.delete(entityId);

        const queuedUpdate = queuedUpdates.get(entityId);
        if (!queuedUpdate) {
          continue;
        }

        queuedUpdates.delete(entityId);

        if (!shouldApplyUpdate(entityId, queuedUpdate, ledger)) {
          continue;
        }

        const value = queuedUpdate.raw;

        if (queuedUpdate.isDelete) {
          world.deleteEntity(entityId as Entity);
        }

        const existing = batch[entityId];
        if (existing) {
          if (!queuedUpdate.isDelete) {
            batch[entityId] = mergeDeep(existing, value);
          }
        } else {
          batch[entityId] = value;
        }

        appliedUpdates.push({ entityId, update: queuedUpdate });
        processedCount++;
      }

      if (Object.keys(batch).length > 0) {
        try {
          if (logging) console.log("Applying batch update", batch);

          const modelsArray = Object.values(batch).map((value) => {
            return { hashed_keys: value.hashed_keys, models: value.models };
          });

          setEntities(modelsArray, world.components, logging);

          appliedUpdates.forEach(({ entityId, update }) => {
            updateLedger(entityId, update, ledger);
          });

          guard?.notifyUpdate(appliedUpdates.map(({ update }) => update));
        } catch (error) {
          console.error("Error processing entity batch:", error);
        }
      }

      if (pendingEntityIds.length === 0) {
        break;
      }
    }

    isProcessing = false;

    if (pendingEntityIds.length > 0) {
      setTimeout(processNextInQueue, 0);
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
  const queueUpdate = (entityId: string, data: ToriiEntity) => {
    const update = extractQueuedUpdate(entityId, data);
    const existing = queuedUpdates.get(entityId);

    if (!existing || isIncomingUpdateNewer(update, existing)) {
      queuedUpdates.set(entityId, update);
    }

    if (!pendingEntityIdSet.has(entityId)) {
      pendingEntityIdSet.add(entityId);
      pendingEntityIds.push(entityId);
    }

    if (!isProcessing) {
      setTimeout(processNextInQueue, 50);
    }
  };

  let subscriptionCancelers: Array<() => void> = [];

  const unsubscribe = () => {
    if (subscriptionCancelers.length === 0) return;
    subscriptionCancelers.forEach((cancel) => {
      try {
        cancel();
      } catch (error) {
        console.warn("[sync] Failed to cancel subscription", error);
      }
    });
    subscriptionCancelers = [];
  };

  const subscribe = async () => {
    const entitySub = await client.onEntityUpdated(entityKeyClause, (data: any) => {
      if (logging) console.log("Entity updated", data);

      try {
        queueUpdate(data.hashed_keys, data);
      } catch (error) {
        console.error("Error queuing entity update:", error);
      }
    });

    const eventSub = await client.onEventMessageUpdated(entityKeyClause, (data: any) => {
      if (logging) console.log("Event message updated", data.hashed_keys);

      try {
        queueUpdate(data.hashed_keys, data);
      } catch (error) {
        console.error("Error queuing event message update:", error);
      }
    });

    subscriptionCancelers = [entitySub.cancel, eventSub.cancel];
  };

  const resubscribe = async () => {
    unsubscribe();
    await subscribe();
  };

  guard = new SyncGuard({
    client,
    clause: entityKeyClause,
    queueUpdate,
    logging,
    config: guardConfig,
    onStateChange,
    resubscribe,
  });

  await subscribe();
  guard.start();

  const getQueueStats = () => ({
    queuedCount: queuedUpdates.size,
    pendingCount: pendingEntityIds.length,
    queuedEntityIds: Array.from(queuedUpdates.keys()),
    pendingEntityIds: [...pendingEntityIds],
  });

  const getLedgerSnapshot = ({ entityId, limit = 10 }: SyncLedgerSnapshotOptions = {}) => {
    const entries: Array<ReturnType<typeof formatLedgerEntry>> = [];
    if (entityId) {
      const entry = ledger.get(entityId);
      if (entry) entries.push(formatLedgerEntry(entityId, entry));
    } else {
      let count = 0;
      for (const [id, entry] of ledger.entries()) {
        entries.push(formatLedgerEntry(id, entry));
        count += 1;
        if (count >= limit) break;
      }
    }
    return {
      total: ledger.size,
      entries,
    };
  };

  const cancelSync = () => {
    guard?.stop();
    unsubscribe();
    debugDetach?.();
  };

  debugDetach = attachSyncDebug({
    enabled: debugEnabled,
    identifier: debugId,
    guard: {
      getState: () => guard?.getState() ?? "streaming",
      getSnapshot: () => guard?.getSnapshot() ?? {
        state: "streaming",
        lastAppliedAt: Date.now(),
        lastAppliedBlock: undefined,
        isReplaying: false,
        replayAttempts: 0,
      },
      forceReplay: () => guard?.forceReplay() ?? Promise.resolve(),
    },
    cancel: () => cancelSync(),
    queue: () => getQueueStats(),
    ledgerSnapshot: (options) => getLedgerSnapshot(options),
    extras: () => ({ logging }),
  });

  return {
    cancel: cancelSync,
    getState: () => guard?.getState() ?? "streaming",
    forceReplay: () => guard?.forceReplay() ?? Promise.resolve(),
  };
};

const formatLedgerEntry = (entityId: string, entry: EntityLedgerEntry) => ({
  entityId,
  blockNumber: entry.blockNumber?.toString(),
  eventIndex: entry.eventIndex,
  isDeleted: entry.isDeleted,
  components: Object.fromEntries(
    Array.from(entry.components.entries()).map(([component, timestamp]) => [component, timestamp.toString()]),
  ),
});

// initial sync runs before the game is playable and should sync minimal data
export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
) => {
  const mapDataStore = MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi);

  let lastGuardState: SyncGuardState | null = null;
  await syncEntitiesDebounced(setup.network.toriiClient, setup, null, {
    logging: false,
    debugId: "torii-sync:game",
    debugEnabled: typeof window !== "undefined" ? import.meta.env.DEV : false,
    onStateChange: (stateChange) => {
      if (stateChange === "streaming" && lastGuardState === "replaying") {
        mapDataStore.refresh().catch((error) => console.warn("[sync] map refresh after replay failed", error));
      }
      if (stateChange === "error") {
        mapDataStore.refresh().catch((error) => console.warn("[sync] map refresh after error failed", error));
      }
      lastGuardState = stateChange;
    },
  });

  let start = performance.now();
  let end;

  // BANKS
  await getBankStructuresFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] bank structures query", end - start);
  setInitialSyncProgress(10);

  // // SPECTATOR REALM
  const firstNonOwnedStructure = await sqlApi.fetchFirstStructure();

  if (firstNonOwnedStructure) {
    state.setSpectatorRealmEntityId(firstNonOwnedStructure.entity_id);
    await getStructuresDataFromTorii(setup.network.toriiClient, setup.network.contractComponents as any, [
      {
        entityId: firstNonOwnedStructure.entity_id,
        position: { col: firstNonOwnedStructure.coord_x, row: firstNonOwnedStructure.coord_y },
      },
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
  await getAddressNamesFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] address names query", end - start);
  setInitialSyncProgress(75);

  start = performance.now();
  await getGuildsFromTorii(setup.network.toriiClient, setup.network.contractComponents as any);
  end = performance.now();
  console.log("[sync] guilds query", end - start);
  setInitialSyncProgress(90);

  start = performance.now();
  await mapDataStore.refresh();
  mapDataStore.startAutoRefresh();
  end = performance.now();
  console.log("[sync] fetching the map data store", end - start);
  setInitialSyncProgress(100);
};
