import type { SetupResult } from "@bibliothecadao/dojo";
import type {
  GameSyncEntity,
  GameSyncEntityStoreOperation,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncStore,
} from "@bibliothecadao/eternum/game-sync";
import { requireActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import type { Component, Entity, Metadata, Schema } from "@dojoengine/recs";
import { getComponentEntities, getComponentValue, removeComponent, Type as RecsType } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, Entity as ToriiEntity, Query } from "@dojoengine/torii-wasm/types";
import { appendConsoleFields } from "@/utils/console-message";
import { filterEntityToActiveGameScope } from "./game-scope-entity-filter";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";
import { setupToriiSubscriptions, type ToriiSubscriptionSetupTimeoutInfo } from "./torii-subscription-setup";
import { ToriiEventGapFill } from "./torii-event-gap-fill";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";

export const GAMEWIDE_SNAPSHOT_PAGE_SIZE = 500;
const TARGETED_ENTITY_QUERY_LIMIT = 40_000;
const EVENT_GAP_FILL_PAGE_SIZE = 100;

export const fetchEntitiesIntoGameSync = async (
  client: SetupResult["network"]["toriiClient"],
  clause: Clause,
  models: string[],
  limit = TARGETED_ENTITY_QUERY_LIMIT,
): Promise<void> => {
  const visitedCursors = new Set<string>();
  let cursor: string | undefined;

  for (;;) {
    const page = await client.getEntities({
      pagination: { limit, cursor, direction: "Forward", order_by: [] },
      clause,
      no_hashed_keys: false,
      models,
      historical: false,
    });
    await requireActiveGameSyncRuntime().applyAuthoritativeEntities(page.items as GameSyncEntity[]);
    if (page.items.length < limit || !page.next_cursor) return;
    if (visitedCursors.has(page.next_cursor)) {
      throw new Error(`Torii entity query cursor repeated: ${page.next_cursor}`);
    }
    visitedCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
};

interface CreateGamewideSyncSessionInput {
  setup: SetupResult;
  entityClause: Clause;
  eventClause: Clause;
  eventModels: readonly string[];
  entityModels: readonly string[];
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  snapshotPageTimeoutMs: number;
  eventReplayPageTimeoutMs: number;
  pageRetryCount: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  onSubscriptionActive?: () => void;
  onLiveEntity?: (entity: GameSyncEntity) => void;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onStreamClose?: (stream: "entity" | "event", reason: string) => void;
}

const qualifiedComponentName = (component: Component): string | null => {
  const namespace = component.metadata?.namespace;
  const name = component.metadata?.name;
  return namespace && name ? `${namespace}-${name}` : null;
};

// Event components live nested under `events`. RECS writes need every component in
// one flat list — a component missing from the list makes setEntities skip its rows
// silently, which is how the entire event stream went dark for chest reveals.
const flattenContractComponents = (
  contractComponents: SetupResult["network"]["contractComponents"],
): Component<Schema, Metadata, undefined>[] => {
  const { events, ...modelComponents } = contractComponents;
  return [...Object.values(modelComponents), ...Object.values(events ?? {})] as unknown as Component<
    Schema,
    Metadata,
    undefined
  >[];
};

const reportUnresolvableSyncModels = (lookup: Map<string, Component>, models: readonly string[]): void => {
  const unresolved = models.filter((model) => !lookup.has(model));
  if (unresolved.length === 0) return;
  console.error(`[GameSync] sync models without a RECS component would be dropped silently: ${unresolved.join(", ")}`);
};

const createComponentLookup = (components: readonly Component[]): Map<string, Component> => {
  const lookup = new Map<string, Component>();
  components.forEach((component) => {
    const name = qualifiedComponentName(component);
    if (name) lookup.set(name, component);
    const logicalName = component.metadata?.name;
    if (typeof logicalName === "string") lookup.set(logicalName, component);
  });
  return lookup;
};

const buildDojoTypedValue = (type: string, value: unknown): Record<string, unknown> => ({
  key: false,
  type,
  type_name: "",
  value,
});

const DOJO_ARRAY_ITEM_TYPES = new Map<RecsType, RecsType>([
  [RecsType.NumberArray, RecsType.Number],
  [RecsType.BigIntArray, RecsType.BigInt],
  [RecsType.StringArray, RecsType.String],
  [RecsType.EntityArray, RecsType.Entity],
]);

const DOJO_OPTIONAL_VALUE_TYPES = new Map<RecsType, RecsType>([
  [RecsType.OptionalNumber, RecsType.Number],
  [RecsType.OptionalBigInt, RecsType.BigInt],
  [RecsType.OptionalString, RecsType.String],
  [RecsType.OptionalNumberArray, RecsType.NumberArray],
  [RecsType.OptionalBigIntArray, RecsType.BigIntArray],
  [RecsType.OptionalStringArray, RecsType.StringArray],
  [RecsType.OptionalEntity, RecsType.Entity],
  [RecsType.OptionalEntityArray, RecsType.EntityArray],
  [RecsType.OptionalT, RecsType.T],
]);

const isDojoTypedValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).type === "string" &&
  Object.hasOwn(value, "value");

const requireGameSyncRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Game sync model value does not match its RECS struct schema");
  }
  return value as Record<string, unknown>;
};

const requireGameSyncArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Game sync model value does not match its RECS array schema");
  return value;
};

const encodeGameSyncValueForDojo = (schema: unknown, value: unknown): Record<string, unknown> => {
  if (isDojoTypedValue(value)) return value;

  if (Array.isArray(schema)) {
    return buildDojoTypedValue(
      "array",
      requireGameSyncArray(value).map((item) => encodeGameSyncValueForDojo(schema[0], item)),
    );
  }

  if (typeof schema === "object" && schema !== null) {
    const fields = requireGameSyncRecord(value);
    return buildDojoTypedValue(
      "struct",
      Object.fromEntries(
        Object.entries(schema).flatMap(([field, fieldSchema]) =>
          Object.hasOwn(fields, field) ? [[field, encodeGameSyncValueForDojo(fieldSchema, fields[field])]] : [],
        ),
      ),
    );
  }

  const recsType = schema as RecsType;
  const optionalType = DOJO_OPTIONAL_VALUE_TYPES.get(recsType);
  if (optionalType !== undefined) {
    return {
      ...buildDojoTypedValue("enum", {
        option: value == null ? "None" : "Some",
        value: value == null ? undefined : encodeGameSyncValueForDojo(optionalType, value),
      }),
      type_name: "Option",
    };
  }

  const itemType = DOJO_ARRAY_ITEM_TYPES.get(recsType);
  if (itemType !== undefined) {
    return buildDojoTypedValue(
      "array",
      requireGameSyncArray(value).map((item) => encodeGameSyncValueForDojo(itemType, item)),
    );
  }

  return buildDojoTypedValue("primitive", value);
};

const encodeGameSyncModelForDojo = (component: Component, value: unknown): Record<string, unknown> => {
  const fields = requireGameSyncRecord(value);
  return Object.fromEntries(
    Object.entries(component.schema).flatMap(([field, schema]) =>
      Object.hasOwn(fields, field) ? [[field, encodeGameSyncValueForDojo(schema, fields[field])]] : [],
    ),
  );
};

export const createRecsGameSyncStore = (
  setup: SetupResult,
  logging: boolean,
  syncModels: readonly string[],
): GameSyncStore => {
  const authoritativeComponents = flattenContractComponents(setup.network.contractComponents);
  const authoritativeComponentLookup = createComponentLookup(authoritativeComponents);
  reportUnresolvableSyncModels(authoritativeComponentLookup, syncModels);
  const applyOperations = async (operations: readonly GameSyncEntityStoreOperation[]) => {
    for (const operation of operations) {
      if (operation.type === "upsert") {
        const dojoEntities = operation.entities.map((entity) => ({
          ...entity,
          models: Object.fromEntries(
            Object.entries(entity.models).map(([model, value]) => {
              const component = authoritativeComponentLookup.get(model);
              if (!component) return [model, value];
              return [qualifiedComponentName(component) ?? model, encodeGameSyncModelForDojo(component, value)];
            }),
          ),
        }));
        await setEntities(dojoEntities as ToriiEntity[], authoritativeComponents, logging);
        operation.entities.forEach((entity) => {
          Object.keys(entity.models).forEach((model) => {
            const component = authoritativeComponentLookup.get(model);
            if (!component) return;
            const value = getComponentValue(component, entity.hashed_keys as Entity) as
              | Record<string, unknown>
              | undefined;
            if (!value) {
              if (import.meta.env.DEV) {
                console.error(
                  appendConsoleFields("[GameSync] authoritative Torii model did not parse into RECS", {
                    entity_id: entity.hashed_keys,
                    model,
                  }),
                );
              }
              return;
            }
          });
        });
        continue;
      }
      if (operation.type === "delete-entity") {
        setup.network.world.deleteEntity(operation.entityId as Entity);
        continue;
      }

      operation.models.forEach((model) => {
        const component = authoritativeComponentLookup.get(model);
        if (!component) return;
        removeComponent(component, operation.entityId as Entity);
      });
    }
  };

  return {
    applyEntityOperations: applyOperations,
    async applyEvent(event) {
      await setEntities([event] as ToriiEntity[], authoritativeComponents, logging);
      Object.keys(event.models).forEach((model) => {
        const component = authoritativeComponentLookup.get(model);
        if (component) removeComponent(component, event.hashed_keys as Entity);
      });
    },
    listModelEntityIds(model) {
      const component = authoritativeComponentLookup.get(model);
      return component ? getComponentEntities(component) : [];
    },
  };
};

export const GAME_SYNC_FRAME_FALLBACK_MS = 100;

export const createBrowserScheduler = (): NonNullable<GameSyncSessionStart["scheduler"]> => ({
  schedule(task) {
    let active = true;
    let frame: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const runIngestSlice = () => {
      if (!active) return;
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (timeout !== undefined) clearTimeout(timeout);
      runWithFrameWorkOwner("sync:ingest", task);
    };

    if (typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function") {
      frame = requestAnimationFrame(runIngestSlice);
      timeout = setTimeout(runIngestSlice, GAME_SYNC_FRAME_FALLBACK_MS);
    } else {
      timeout = setTimeout(runIngestSlice, 0);
    }

    return () => {
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (timeout !== undefined) clearTimeout(timeout);
    };
  },
});

const runWithTimeout = async <T>(
  label: string,
  timeoutMs: number,
  operation: () => Promise<T>,
  onTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void,
): Promise<T> => {
  if (timeoutMs <= 0) return operation();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout?.({ label, timeoutMs });
      reject(new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`));
    }, timeoutMs);

    operation().then(
      (result) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        reject(error);
      },
    );
  });
};

const runPageWithRetries = async <T>({
  label,
  timeoutMs,
  retryCount,
  operation,
  onTimeout,
}: {
  label: string;
  timeoutMs: number;
  retryCount: number;
  operation: () => Promise<T>;
  onTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}): Promise<T> => {
  const maxAttempts = Math.max(1, retryCount + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runWithTimeout(label, timeoutMs, operation, onTimeout);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      console.warn(`[Sync] ${label} failed; retrying page (${attempt}/${maxAttempts})`, error);
    }
  }

  throw lastError;
};

export const createGamewideSyncSession = (input: CreateGamewideSyncSessionInput): GameSyncSessionStart => {
  const client = input.setup.network.toriiClient;

  const fetchEventPage = (cursor?: string) =>
    runPageWithRetries({
      label: "event gap-fill page",
      timeoutMs: input.eventReplayPageTimeoutMs,
      retryCount: input.pageRetryCount,
      operation: async () => {
        const query: Query = {
          pagination: {
            limit: EVENT_GAP_FILL_PAGE_SIZE,
            cursor,
            direction: "Backward",
            order_by: [],
          },
          clause: input.eventClause,
          no_hashed_keys: false,
          models: [...input.eventModels],
          historical: false,
        };
        const page = await client.getEventMessages(query);
        return { items: page.items, nextCursor: page.next_cursor };
      },
      onTimeout: input.onSubscriptionSetupTimeout,
    });

  const eventGapFill = new ToriiEventGapFill({ fetchPage: fetchEventPage });
  let hasOpenedEventStream = false;
  let replayArmed = false;
  let baselinePromise: Promise<void> | null = null;

  const armReplayBaseline = (): void => {
    if (replayArmed || baselinePromise || input.eventModels.length === 0) return;

    baselinePromise = eventGapFill
      .establishBaseline()
      .then(() => {
        replayArmed = true;
      })
      .catch((error) => {
        console.warn("[Sync] event replay baseline failed; the next live event will arm recovery replay", error);
      })
      .finally(() => {
        baselinePromise = null;
      });
  };

  return {
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, input.logging, [...input.entityModels, ...input.eventModels]),
    scheduler: createBrowserScheduler(),
    now: () => performance.now(),
    onSubscriptionActive: input.onSubscriptionActive,
    onLiveUpdate: input.onLiveUpdate,
    onMetrics: input.onMetrics,
    transport: {
      async subscribe(handlers) {
        if (hasOpenedEventStream && !replayArmed && baselinePromise) {
          await baselinePromise;
        }
        const replayWatermark = hasOpenedEventStream && replayArmed ? eventGapFill.captureWatermark() : null;
        const subscriptions = await setupToriiSubscriptions({
          createEntitySubscription: () =>
            client.onEntityUpdated(input.entityClause, (entity: ToriiEntity) => {
              const scoped = filterEntityToActiveGameScope(entity);
              if (!scoped) return;
              input.onLiveEntity?.(scoped);
              handlers.onEntity(scoped);
            }),
          createEventSubscription: () =>
            client.onEventMessageUpdated(input.eventClause, (event: ToriiEntity) => {
              replayArmed = true;
              eventGapFill.handleLiveEvent(event, handlers.onEvent);
            }),
          subscriptionSetupTimeoutMs: input.subscriptionSetupTimeoutMs,
          onSubscriptionSetupTimeout: input.onSubscriptionSetupTimeout,
        });
        const detachEntityLifecycle = observeToriiStreamLifecycle(subscriptions.entitySubscription, ({ reason }) =>
          input.onStreamClose?.("entity", reason),
        );
        const detachEventLifecycle = observeToriiStreamLifecycle(subscriptions.eventSubscription, ({ reason }) =>
          input.onStreamClose?.("event", reason),
        );

        try {
          if (replayWatermark) {
            const replayedEventCount = await eventGapFill.replaySince(replayWatermark, handlers.onEvent);
            if (replayedEventCount > 0) {
              console.warn(`[Sync] event gap-fill replayed ${replayedEventCount} events`);
              handlers.onEventGapFill(replayedEventCount);
            }
          } else if (hasOpenedEventStream) {
            console.warn("[Sync] event recovery opened before a replay watermark was available");
          }
        } catch (error) {
          detachEntityLifecycle();
          detachEventLifecycle();
          subscriptions.cancel();
          throw error;
        }

        hasOpenedEventStream = true;
        armReplayBaseline();
        return {
          cancel() {
            detachEntityLifecycle();
            detachEventLifecycle();
            subscriptions.cancel();
          },
        };
      },
      fetchSnapshotPage(cursor) {
        return runPageWithRetries({
          label: "game-wide snapshot page",
          timeoutMs: input.snapshotPageTimeoutMs,
          retryCount: input.pageRetryCount,
          operation: async () => {
            const page = await client.getEntities({
              pagination: {
                limit: GAMEWIDE_SNAPSHOT_PAGE_SIZE,
                cursor,
                direction: "Forward",
                order_by: [],
              },
              clause: input.entityClause,
              no_hashed_keys: false,
              models: [...input.entityModels],
              historical: false,
            });
            const items = page.items
              .map((item) => filterEntityToActiveGameScope(item))
              .filter((item): item is ToriiEntity => item !== null);
            return { items, nextCursor: page.next_cursor };
          },
          onTimeout: input.onSubscriptionSetupTimeout,
        });
      },
    },
  };
};
