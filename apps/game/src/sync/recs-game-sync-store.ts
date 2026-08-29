import type { SetupResult } from "@bibliothecadao/dojo";
import type {
  GameSyncEntityStoreOperation,
  GameSyncSessionStart,
  GameSyncStore,
} from "@bibliothecadao/eternum/game-sync";
import type { Component, Entity, Metadata, Schema } from "@dojoengine/recs";
import { getComponentEntities, getComponentValue, removeComponent, Type as RecsType } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { appendConsoleFields } from "@/utils/console-message";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";

interface DojoEntity {
  hashed_keys: string;
  models: Record<string, unknown>;
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
        await setEntities(dojoEntities as never[], authoritativeComponents, logging);
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
                  appendConsoleFields("[GameSync] authoritative model did not parse into RECS", {
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
      await setEntities([event] as DojoEntity[], authoritativeComponents, logging);
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

const GAME_SYNC_FRAME_FALLBACK_MS = 100;

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
