import type { SetupResult } from "@bibliothecadao/dojo";
import type {
  GameSyncEntityStoreOperation,
  GameSyncSessionStart,
  GameSyncStore,
} from "@bibliothecadao/eternum/game-sync";
import type { Component, ComponentValue, Entity, Metadata, Schema } from "@dojoengine/recs";
import {
  getComponentEntities,
  hasComponent,
  removeComponent,
  setComponent,
  Type as RecsType,
  updateComponent,
} from "@dojoengine/recs";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { requestFrameOrTimeout } from "@/utils/frame-or-timeout";

type ValueCoercer = (value: unknown) => unknown;
type AuthoritativeComponent = Component<Schema, Metadata, undefined>;

const qualifiedComponentName = (component: Component): string | null => {
  const namespace = component.metadata?.namespace;
  const name = component.metadata?.name;
  return namespace && name ? `${namespace}-${name}` : null;
};

// Event components live nested under `events`. The lookup needs every component in one flat
// list; a sync model without a component would otherwise be dropped silently.
const flattenContractComponents = (
  contractComponents: SetupResult["network"]["contractComponents"],
): AuthoritativeComponent[] => {
  const { events, ...modelComponents } = contractComponents;
  return [...Object.values(modelComponents), ...Object.values(events ?? {})] as unknown as AuthoritativeComponent[];
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

const OPTIONAL_VALUE_TYPES = new Map<RecsType, RecsType>([
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

// Herald encodes felts as decimal or 0x-prefixed strings; a bare hex string is the last resort
// before the raw value goes through, which is loud in the console rather than a silent zero.
const coerceBigInt = (value: unknown): unknown => {
  if (typeof value === "bigint") return value;
  try {
    return BigInt(value as string);
  } catch {
    try {
      return BigInt(`0x${String(value)}`);
    } catch {
      console.warn(`[GameSync] ${String(value)} is not a felt; keeping the raw value`);
      return value;
    }
  }
};

// StringArray members hold felts or enum names: felts become bigint, names stay strings.
const coerceStringArrayItem = (item: unknown): unknown => {
  try {
    return BigInt(item as string);
  } catch {
    return item;
  }
};

const compileArrayCoercer = (coerceItem: ValueCoercer): ValueCoercer => {
  return (value) => requireGameSyncArray(value).map(coerceItem);
};

const compileRecordCoercer = (schema: Record<string, unknown>): ValueCoercer => {
  const fields = Object.entries(schema).map(
    ([field, fieldSchema]) => [field, compileValueCoercer(fieldSchema)] as const,
  );
  return (value) => {
    const record = requireGameSyncRecord(value);
    const coerced: Record<string, unknown> = {};
    for (const [field, coerce] of fields) {
      if (Object.hasOwn(record, field)) coerced[field] = coerce(record[field]);
    }
    return coerced;
  };
};

const tupleSpanMemberCount = (type: unknown): number | null => {
  if (typeof type !== "string") return null;
  const match = type.match(/^Span<\((.+)\)>$/);
  return match ? match[1].split(",").length : null;
};

const unwrapTypedValue = (value: unknown): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.hasOwn(value, "value")
    ? (value as { value: unknown }).value
    : value;

const compileTupleSpanCoercer =
  (memberCount: number): ValueCoercer =>
  (value) =>
    requireGameSyncArray(value).map((entry) => {
      const tuple = unwrapTypedValue(entry);
      if (!Array.isArray(tuple) || tuple.length !== memberCount) {
        throw new Error(`Game sync tuple must contain ${memberCount} members`);
      }
      // Tuple spans have no faithful primitive-array representation in RECS.
      // Preserve Herald's tuple (or the legacy typed-value envelope) for the
      // domain decoder instead of coercing the whole tuple to Number/NaN.
      return entry;
    });

const countSchemaLeaves = (schema: unknown): number => {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) return 1;
  return Object.values(schema).reduce((total, field) => total + countSchemaLeaves(field), 0);
};

const compileComponentCoercer = (component: Component): ValueCoercer => {
  const metadataTypes = Array.isArray(component.metadata?.types) ? component.metadata.types : [];
  let metadataIndex = 0;
  const fields = Object.entries(component.schema as Record<string, unknown>).map(([field, fieldSchema]) => {
    const fieldType = metadataTypes[metadataIndex];
    metadataIndex += countSchemaLeaves(fieldSchema);
    const tupleMemberCount = tupleSpanMemberCount(fieldType);
    const coerce =
      tupleMemberCount === null ? compileValueCoercer(fieldSchema) : compileTupleSpanCoercer(tupleMemberCount);
    return [field, coerce] as const;
  });

  return (value) => {
    const record = requireGameSyncRecord(value);
    const coerced: Record<string, unknown> = {};
    for (const [field, coerce] of fields) {
      if (Object.hasOwn(record, field)) coerced[field] = coerce(record[field]);
    }
    return coerced;
  };
};

const compilePrimitiveCoercer = (recsType: RecsType): ValueCoercer => {
  switch (recsType) {
    case RecsType.Number:
      return (value) => Number(value);
    case RecsType.BigInt:
      return coerceBigInt;
    case RecsType.NumberArray:
      return compileArrayCoercer((item) => Number(item));
    case RecsType.BigIntArray:
      return compileArrayCoercer(coerceBigInt);
    case RecsType.StringArray:
      return compileArrayCoercer(coerceStringArrayItem);
    default:
      return (value) => value;
  }
};

/** One coercer per schema node, compiled once per component: the herald JSON row becomes the typed RECS value. */
const compileValueCoercer = (schema: unknown): ValueCoercer => {
  if (Array.isArray(schema)) return compileArrayCoercer(compileValueCoercer(schema[0]));
  if (typeof schema === "object" && schema !== null) return compileRecordCoercer(schema as Record<string, unknown>);

  const recsType = schema as RecsType;
  const optionalType = OPTIONAL_VALUE_TYPES.get(recsType);
  if (optionalType !== undefined) {
    const coerceInner = compileValueCoercer(optionalType);
    return (value) => (value == null ? null : coerceInner(value));
  }
  return compilePrimitiveCoercer(recsType);
};

const createComponentCoercers = () => {
  const coercers = new Map<Component, ValueCoercer>();
  return (component: Component): ValueCoercer => {
    let coercer = coercers.get(component);
    if (!coercer) {
      coercer = compileComponentCoercer(component);
      coercers.set(component, coercer);
    }
    return coercer;
  };
};

export const createRecsGameSyncStore = (setup: SetupResult, syncModels: readonly string[]): GameSyncStore => {
  const authoritativeComponents = flattenContractComponents(setup.network.contractComponents);
  const authoritativeComponentLookup = createComponentLookup(authoritativeComponents);
  reportUnresolvableSyncModels(authoritativeComponentLookup, syncModels);
  const coercerFor = createComponentCoercers();

  // Herald rows can be partial member updates, so an existing row merges instead of being replaced.
  const writeRow = (component: Component, entity: Entity, value: unknown): void => {
    const coerced = coercerFor(component)(value) as ComponentValue<Schema>;
    if (hasComponent(component, entity)) updateComponent(component, entity, coerced);
    else setComponent(component, entity, coerced);
  };

  const applyUpsert = (entities: Extract<GameSyncEntityStoreOperation, { type: "upsert" }>["entities"]): void => {
    for (const entity of entities) {
      for (const [model, value] of Object.entries(entity.models)) {
        const component = authoritativeComponentLookup.get(model);
        if (component) writeRow(component, entity.hashed_keys as Entity, value);
      }
    }
  };

  const applyOperation = (operation: GameSyncEntityStoreOperation): void => {
    if (operation.type === "upsert") {
      applyUpsert(operation.entities);
      return;
    }
    if (operation.type === "delete-entity") {
      setup.network.world.deleteEntity(operation.entityId as Entity);
      return;
    }
    operation.models.forEach((model) => {
      const component = authoritativeComponentLookup.get(model);
      if (component) removeComponent(component, operation.entityId as Entity);
    });
  };

  return {
    applyEntityOperations(operations) {
      operations.forEach(applyOperation);
    },
    // Event rows are ephemera: the write fires the RECS update stream, the removal keeps no row behind.
    applyEvent(event) {
      Object.entries(event.models).forEach(([model, value]) => {
        const component = authoritativeComponentLookup.get(model);
        if (!component) return;
        writeRow(component, event.hashed_keys as Entity, value);
        removeComponent(component, event.hashed_keys as Entity);
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
    return requestFrameOrTimeout(() => runWithFrameWorkOwner("sync:ingest", task), GAME_SYNC_FRAME_FALLBACK_MS);
  },
});
