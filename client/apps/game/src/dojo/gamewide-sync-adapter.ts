import type { SetupResult } from "@bibliothecadao/dojo";
import type {
  GameSyncEntity,
  GameSyncEntityStoreOperation,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncStore,
} from "@bibliothecadao/eternum/game-sync";
import type { Component, Entity, Metadata, Schema } from "@dojoengine/recs";
import { getComponentEntities, removeComponent } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import type { Clause, Entity as ToriiEntity } from "@dojoengine/torii-wasm/types";
import { filterEntityToActiveGameScope } from "./game-scope-entity-filter";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";
import { setupToriiSubscriptions, type ToriiSubscriptionSetupTimeoutInfo } from "./torii-subscription-setup";

export const GAMEWIDE_SNAPSHOT_PAGE_SIZE = 500;

interface CreateGamewideSyncSessionInput {
  setup: SetupResult;
  entityClause: Clause;
  eventClause: Clause;
  entityModels: readonly string[];
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  onSubscriptionActive?: () => void;
  onLiveEntity?: (entity: GameSyncEntity) => void;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onStreamClose?: () => void;
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
  });
  return lookup;
};

const createRecsGameSyncStore = (setup: SetupResult, logging: boolean): GameSyncStore => {
  const components = Object.values(setup.network.contractComponents) as unknown as Component<
    Schema,
    Metadata,
    undefined
  >[];
  const componentLookup = createComponentLookup(components);

  const applyOperations = async (operations: readonly GameSyncEntityStoreOperation[]) => {
    for (const operation of operations) {
      if (operation.type === "upsert") {
        await setEntities(operation.entities as ToriiEntity[], components, logging);
        continue;
      }
      if (operation.type === "delete-entity") {
        setup.network.world.deleteEntity(operation.entityId as Entity);
        continue;
      }

      operation.models.forEach((model) => {
        const component = componentLookup.get(model);
        if (component) removeComponent(component, operation.entityId as Entity);
      });
    }
  };

  return {
    applyEntityOperations: applyOperations,
    async applyEvent(event) {
      await setEntities([event] as ToriiEntity[], components, logging);
      Object.keys(event.models).forEach((model) => {
        const component = componentLookup.get(model);
        if (component) removeComponent(component, event.hashed_keys as Entity);
      });
    },
    listModelEntityIds(model) {
      const component = componentLookup.get(model);
      return component ? getComponentEntities(component) : [];
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

  return {
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, input.logging),
    scheduler: createBrowserScheduler(),
    now: () => performance.now(),
    onSubscriptionActive: input.onSubscriptionActive,
    onLiveUpdate: input.onLiveUpdate,
    onMetrics: input.onMetrics,
    transport: {
      async subscribe(handlers) {
        const subscriptions = await setupToriiSubscriptions({
          createEntitySubscription: () =>
            client.onEntityUpdated(input.entityClause, (entity: ToriiEntity) => {
              const scoped = filterEntityToActiveGameScope(entity);
              if (!scoped) return;
              input.onLiveEntity?.(scoped);
              handlers.onEntity(scoped);
            }),
          createEventSubscription: () =>
            client.onEventMessageUpdated(input.eventClause, (event: ToriiEntity) => handlers.onEvent(event)),
          subscriptionSetupTimeoutMs: input.subscriptionSetupTimeoutMs,
          onSubscriptionSetupTimeout: input.onSubscriptionSetupTimeout,
        });
        const detachLifecycle = [
          observeToriiStreamLifecycle(subscriptions.entitySubscription, () => input.onStreamClose?.()),
          observeToriiStreamLifecycle(subscriptions.eventSubscription, () => input.onStreamClose?.()),
        ];
        return {
          cancel() {
            detachLifecycle.forEach((detach) => detach());
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
