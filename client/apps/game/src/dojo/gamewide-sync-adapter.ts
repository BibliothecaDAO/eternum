import type { SetupResult } from "@bibliothecadao/dojo";
import type {
  GameSyncAuthoritativeObservation,
  GameSyncEntity,
  GameSyncEntityStoreOperation,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncStore,
} from "@bibliothecadao/eternum/game-sync";
import type { Component, Entity, Metadata, OverridableComponent, Schema } from "@dojoengine/recs";
import { getComponentEntities, getComponentValue, removeComponent } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, Entity as ToriiEntity, Query } from "@dojoengine/torii-wasm/types";
import { filterEntityToActiveGameScope } from "./game-scope-entity-filter";
import { createRecoveringToriiEventSubscription } from "./recovering-torii-event-subscription";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";
import { setupToriiSubscriptions, type ToriiSubscriptionSetupTimeoutInfo } from "./torii-subscription-setup";
import { ToriiEventGapFill } from "./torii-event-gap-fill";

export const GAMEWIDE_SNAPSHOT_PAGE_SIZE = 500;
const EVENT_GAP_FILL_PAGE_SIZE = 100;

interface CreateGamewideSyncSessionInput {
  setup: SetupResult;
  entityClause: Clause;
  eventClause: Clause;
  eventModels: readonly string[];
  entityModels: readonly string[];
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  onSubscriptionActive?: () => void;
  onLiveEntity?: (entity: GameSyncEntity) => void;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onStreamClose?: () => void;
  onEventStreamLost?: (reason: string) => void;
  onEventStreamRestored?: () => void;
}

const qualifiedComponentName = (component: Component): string | null => {
  const namespace = component.metadata?.namespace;
  const name = component.metadata?.name;
  return namespace && name ? `${namespace}-${name}` : null;
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

const createRecsGameSyncStore = (setup: SetupResult, logging: boolean): GameSyncStore => {
  const authoritativeComponents = Object.values(setup.network.contractComponents) as unknown as Component<
    Schema,
    Metadata,
    undefined
  >[];
  const authoritativeComponentLookup = createComponentLookup(authoritativeComponents);
  // setup.components mixes overridable wrappers with the `events` sub-record;
  // createComponentLookup's metadata guards skip the non-component entries.
  const provisionalComponentLookup = createComponentLookup(
    Object.values(setup.components) as unknown as Component<Schema, Metadata, undefined>[],
  );
  const provisionalOverrides = new Map<string, Array<{ component: OverridableComponent; overrideId: string }>>();

  const applyOperations = async (operations: readonly GameSyncEntityStoreOperation[]) => {
    const observations: GameSyncAuthoritativeObservation[] = [];
    for (const operation of operations) {
      if (operation.type === "upsert") {
        await setEntities(operation.entities as ToriiEntity[], authoritativeComponents, logging);
        operation.entities.forEach((entity) => {
          Object.keys(entity.models).forEach((model) => {
            const component = authoritativeComponentLookup.get(model);
            if (!component) return;
            const value = getComponentValue(component, entity.hashed_keys as Entity) as
              | Record<string, unknown>
              | undefined;
            if (!value) {
              if (import.meta.env.DEV) {
                console.error("[GameSync] authoritative Torii model did not parse into RECS", {
                  entityId: entity.hashed_keys,
                  model,
                });
              }
              return;
            }
            observations.push({
              type: "model",
              entityId: entity.hashed_keys,
              model,
              value,
            });
          });
        });
        continue;
      }
      if (operation.type === "delete-entity") {
        setup.network.world.deleteEntity(operation.entityId as Entity);
        observations.push({ type: "delete-entity", entityId: operation.entityId });
        continue;
      }

      operation.models.forEach((model) => {
        const component = authoritativeComponentLookup.get(model);
        if (!component) return;
        removeComponent(component, operation.entityId as Entity);
        observations.push({ type: "model", entityId: operation.entityId, model, value: null });
      });
    }
    return observations;
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
    applyProvisionalWrites(intentId, writes) {
      const resolvedWrites = writes.map((write, index) => {
        const component = provisionalComponentLookup.get(write.model) as OverridableComponent | undefined;
        if (!component) throw new Error(`Cannot apply provisional write for unknown model ${write.model}`);
        return { component, overrideId: `${intentId}:${index}`, write };
      });

      resolvedWrites.forEach(({ component, overrideId, write }) => {
        component.addOverride(overrideId, {
          entity: write.entityId as Entity,
          value: write.patch,
        });
      });
      provisionalOverrides.set(
        intentId,
        resolvedWrites.map(({ component, overrideId }) => ({ component, overrideId })),
      );
    },
    removeProvisionalWrites(intentId) {
      provisionalOverrides.get(intentId)?.forEach(({ component, overrideId }) => component.removeOverride(overrideId));
      provisionalOverrides.delete(intentId);
    },
  };
};

const createBrowserScheduler = (): NonNullable<GameSyncSessionStart["scheduler"]> => ({
  schedule(task) {
    if (typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function") {
      const frame = requestAnimationFrame(task);
      return () => cancelAnimationFrame(frame);
    }
    const timeout = setTimeout(task, 0);
    return () => clearTimeout(timeout);
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

export const createGamewideSyncSession = (input: CreateGamewideSyncSessionInput): GameSyncSessionStart => {
  const client = input.setup.network.toriiClient;

  const fetchEventPage = (cursor?: string) =>
    runWithTimeout(
      "event gap-fill page",
      input.subscriptionSetupTimeoutMs,
      async () => {
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
      input.onSubscriptionSetupTimeout,
    );

  return {
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, input.logging),
    scheduler: createBrowserScheduler(),
    now: () => performance.now(),
    onSubscriptionActive: input.onSubscriptionActive,
    onLiveUpdate: input.onLiveUpdate,
    onMetrics: input.onMetrics,
    onProvisionalIntentStalled: import.meta.env.DEV
      ? (info) => console.error("[GameSync] confirmed provisional intent has not reconciled after 30s", info)
      : undefined,
    transport: {
      async subscribe(handlers) {
        const eventGapFill = new ToriiEventGapFill({
          fetchPage: fetchEventPage,
          handleEvent: handlers.onEvent,
        });
        const subscriptions = await setupToriiSubscriptions({
          createEntitySubscription: () =>
            client.onEntityUpdated(input.entityClause, (entity: ToriiEntity) => {
              const scoped = filterEntityToActiveGameScope(entity);
              if (!scoped) return;
              input.onLiveEntity?.(scoped);
              handlers.onEntity(scoped);
            }),
          createEventSubscription: () =>
            createRecoveringToriiEventSubscription({
              createSubscription: () =>
                client.onEventMessageUpdated(input.eventClause, (event: ToriiEntity) =>
                  eventGapFill.handleLiveEvent(event),
                ),
              establishReplayBaseline: () => eventGapFill.establishBaseline(),
              captureReplayWatermark: () => eventGapFill.captureWatermark(),
              replaySince: (watermark) =>
                eventGapFill.replaySince(watermark as ReturnType<typeof eventGapFill.captureWatermark>),
              onGapFillReplayed: (replayedEventCount) => {
                console.info(`[Sync] event gap-fill replayed ${replayedEventCount} events`);
                handlers.onEventGapFill(replayedEventCount);
              },
              onLost: (reason) => input.onEventStreamLost?.(reason),
              onRestored: () => input.onEventStreamRestored?.(),
              attemptTimeoutMs: input.subscriptionSetupTimeoutMs,
            }),
          subscriptionSetupTimeoutMs: input.subscriptionSetupTimeoutMs,
          onSubscriptionSetupTimeout: input.onSubscriptionSetupTimeout,
        });
        const detachLifecycle = observeToriiStreamLifecycle(subscriptions.entitySubscription, () =>
          input.onStreamClose?.(),
        );
        return {
          cancel() {
            detachLifecycle();
            subscriptions.cancel();
          },
        };
      },
      fetchSnapshotPage(cursor) {
        return runWithTimeout(
          "game-wide snapshot page",
          input.subscriptionSetupTimeoutMs,
          async () => {
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
          input.onSubscriptionSetupTimeout,
        );
      },
    },
  };
};
