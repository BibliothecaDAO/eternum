import {
  nativeFactModels,
  type NativeKeys,
  type NativeModelName,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import type { GameSyncEntity, GameSyncEntityStoreOperation, GameSyncStore } from "../sync/game-sync-types";

type Fact = NativeRows[NativeModelName];
type StoredFact = { readonly row: Fact; readonly wireId: string };
export type NativeFactChange = {
  [M in NativeModelName]: {
    readonly model: M;
    readonly key: string;
    readonly previous?: NativeRows[M];
    readonly current?: NativeRows[M];
  };
}[NativeModelName];
type PendingFact = { readonly key: string; readonly current?: Fact };
type PendingChanges = Map<NativeModelName, Map<string, PendingFact>>;
type WireType = string | readonly [WireType] | { readonly [field: string]: WireType | readonly string[] };
type Decoder = (value: unknown) => unknown;

const definitions = nativeFactModels as Record<
  NativeModelName,
  {
    keys: readonly string[];
    scope: "game" | "deployment";
    fields: Record<string, WireType>;
  }
>;
const decoders = new Map<NativeModelName, Decoder>(
  Object.entries(definitions).map(([name, definition]) => [
    name as NativeModelName,
    compileDecoder(definition.fields, name),
  ]),
);

/** Herald is the only writer. Subscribers see all rows from a transaction before its notification. */
export class NativeFactStore implements GameSyncStore {
  private revision = 0;
  getRevision = (): number => this.revision;

  private readonly models = new Map<NativeModelName, Map<string, StoredFact>>();
  private readonly wireKeys = new Map<NativeModelName, Map<string, string>>();
  private readonly gameKeys = new Map<string, Set<string>>();
  private readonly ownerKeys = new Map<string, Set<string>>();
  private readonly eventListeners = new Set<(event: GameSyncEntity) => void>();
  private readonly listeners = new Set<(changes: readonly NativeFactChange[]) => void>();

  get<M extends NativeModelName>(model: M, keys: NativeKeys[M]): NativeRows[M] | undefined {
    return this.models.get(model)?.get(factKey(model, keys))?.row as NativeRows[M] | undefined;
  }

  require<M extends NativeModelName>(model: M, keys: NativeKeys[M]): NativeRows[M] {
    const row = this.get(model, keys);
    if (!row) throw new Error(`Native ${model} is not synchronized`);
    return row;
  }

  *rows<M extends NativeModelName>(model: M): IterableIterator<NativeRows[M]> {
    for (const value of this.models.get(model)?.values() ?? []) yield value.row as NativeRows[M];
  }

  *entries<M extends NativeModelName>(model: M): IterableIterator<readonly [string, NativeRows[M]]> {
    for (const [key, value] of this.models.get(model) ?? []) yield [key, value.row as NativeRows[M]];
  }

  *inGame<M extends NativeModelName>(model: M, gameId: number): IterableIterator<NativeRows[M]> {
    for (const key of this.gameKeys.get(`${model}:${gameId}`) ?? [])
      yield this.models.get(model)!.get(key)!.row as NativeRows[M];
  }

  *structuresOwnedBy(gameId: number, owner: bigint): IterableIterator<NativeRows["Structure"]> {
    for (const key of this.ownerKeys.get(`${gameId}:${owner}`) ?? [])
      yield this.models.get("Structure")!.get(key)!.row as NativeRows["Structure"];
  }

  subscribe(listener: (changes: readonly NativeFactChange[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listModelEntityIds(model: string): Iterable<string> {
    return this.wireKeys.get(requireModel(model))?.keys() ?? [];
  }

  applyEntityOperations(operations: readonly GameSyncEntityStoreOperation[]): void {
    const pending: PendingChanges = new Map();
    const assignedKeys = new Map<string, string>();
    for (const operation of operations) {
      if (operation.type === "upsert") {
        for (const entity of operation.entities) this.stageEntity(pending, assignedKeys, entity);
      } else {
        const models = operation.type === "delete-entity" ? Object.keys(definitions) : operation.models;
        for (const model of models) this.stageRemoval(pending, requireModel(model), wireId(operation.entityId));
      }
    }
    const changes = this.commit(pending);
    if (changes.length) {
      this.revision += 1;
      for (const listener of this.listeners) listener(changes);
    }
  }

  subscribeEvents(listener: (event: GameSyncEntity) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // The runtime deduplicates effects; confirmation promotions only update its history callback.
  applyEvent(event: GameSyncEntity): void {
    for (const listener of this.eventListeners) listener(event);
  }

  private stageEntity(pending: PendingChanges, assignedKeys: Map<string, string>, entity: GameSyncEntity): void {
    const id = wireId(entity.hashed_keys);
    for (const [name, value] of Object.entries(entity.models)) {
      const model = requireModel(name);
      const row = decoders.get(model)!(value) as Fact;
      if (definitions[model].scope === "game" && gameIdOf(row) === 0) throw new Error(`Reserved game id in ${model}`);
      const key = factKey(model, row);
      const existingKey = this.wireKeys.get(model)?.get(id);
      const existingId = this.models.get(model)?.get(key)?.wireId;
      const assignment = `${model}:${key}`;
      if (
        (existingKey !== undefined && existingKey !== key) ||
        (existingId !== undefined && existingId !== id) ||
        (assignedKeys.has(assignment) && assignedKeys.get(assignment) !== id)
      )
        throw new Error(`Conflicting native keys for ${model}`);
      const prior = pending.get(model)?.get(id);
      if (prior && prior.key !== key) throw new Error(`Changed native keys for ${model}`);
      assignedKeys.set(assignment, id);
      this.pendingModel(pending, model).set(id, { key, current: row });
    }
  }

  private stageRemoval(pending: PendingChanges, model: NativeModelName, id: string): void {
    const key = pending.get(model)?.get(id)?.key ?? this.wireKeys.get(model)?.get(id);
    if (key !== undefined) this.pendingModel(pending, model).set(id, { key });
  }

  private pendingModel(pending: PendingChanges, model: NativeModelName): Map<string, PendingFact> {
    let changes = pending.get(model);
    if (!changes) pending.set(model, (changes = new Map()));
    return changes;
  }

  private commit(pending: PendingChanges): readonly NativeFactChange[] {
    const changes: NativeFactChange[] = [];
    for (const [model, rows] of pending) {
      let values = this.models.get(model);
      let keys = this.wireKeys.get(model);
      if (!values) this.models.set(model, (values = new Map()));
      if (!keys) this.wireKeys.set(model, (keys = new Map()));
      for (const [id, { key, current }] of rows) {
        const previous = values.get(key)?.row;
        if (!previous && !current) continue;
        if (previous) this.index(model, key, previous, false);
        if (current) {
          values.set(key, { row: current, wireId: id });
          keys.set(id, key);
          this.index(model, key, current, true);
        } else {
          values.delete(key);
          keys.delete(id);
        }
        changes.push(Object.freeze({ model, key, previous, current }) as NativeFactChange);
      }
    }
    return Object.freeze(changes);
  }

  private index(model: NativeModelName, key: string, row: Fact, adding: boolean): void {
    if (definitions[model].scope === "game") updateIndex(this.gameKeys, `${model}:${gameIdOf(row)}`, key, adding);
    if (model === "Structure") {
      const structure = row as NativeRows["Structure"];
      updateIndex(this.ownerKeys, `${structure.game_id}:${structure.owner}`, key, adding);
    }
  }
}

function updateIndex(index: Map<string, Set<string>>, group: string, key: string, adding: boolean): void {
  const entries = index.get(group);
  if (adding) {
    if (entries) entries.add(key);
    else index.set(group, new Set([key]));
  } else if (entries) {
    entries.delete(key);
    if (!entries.size) index.delete(group);
  }
}

function requireModel(name: string): NativeModelName {
  if (!Object.hasOwn(definitions, name)) throw new Error(`Unknown native fact ${name}`);
  return name as NativeModelName;
}

function gameIdOf(row: Fact): number {
  return "game_id" in row ? row.game_id : 0;
}

function factKey(model: NativeModelName, keys: object): string {
  return definitions[model].keys
    .flatMap((field) =>
      keyParts((keys as Record<string, unknown>)[field], definitions[model].fields[field], `${model}.${field}`),
    )
    .join(":");
}

function keyParts(value: unknown, type: WireType, path: string): string[] {
  if (typeof type !== "string") {
    if (!value || typeof value !== "object") throw new Error(`Invalid native key ${path}`);
    return Object.entries(type).flatMap(([field, member]) =>
      keyParts((value as Record<string, unknown>)[field], member as WireType, `${path}.${field}`),
    );
  }
  const decoded = compileDecoder(type, path)(value);
  return [typeof decoded === "boolean" ? (decoded ? "1" : "0") : String(decoded)];
}

function wireId(value: string): string {
  return `0x${integer(value, (1n << 251n) + 17n * (1n << 192n) + 1n, "entity id").toString(16)}`;
}

function integer(value: unknown, limit: bigint, path: string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error(`Unsafe integer in ${path}`);
  if (
    typeof value !== "number" &&
    typeof value !== "bigint" &&
    !(typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value))
  )
    throw new Error(`Invalid integer in ${path}`);
  const result = BigInt(value);
  if (result < 0n || result >= limit) throw new Error(`Integer out of range in ${path}`);
  return result;
}

function compileDecoder(type: WireType, path: string): Decoder {
  if (type === "boolean")
    return (value) => {
      if (typeof value !== "boolean") throw new Error(`Invalid boolean in ${path}`);
      return value;
    };
  if (typeof type === "string") {
    const bits = Number(type.slice(1));
    const limit = type === "felt" ? (1n << 251n) + 17n * (1n << 192n) + 1n : 1n << BigInt(bits);
    return (value) => {
      const result = integer(value, limit, path);
      return type !== "felt" && bits <= 32 ? Number(result) : result;
    };
  }
  if (Array.isArray(type)) {
    const item = compileDecoder(type[0], `${path}[]`);
    return (value) => {
      if (!Array.isArray(value)) throw new Error(`Invalid array in ${path}`);
      return Object.freeze(value.map(item));
    };
  }
  if ("enum" in type)
    return (value) => {
      if (typeof value !== "string" || !(type.enum as readonly string[]).includes(value))
        throw new Error(`Invalid enum in ${path}`);
      return value;
    };
  const fields = Object.entries(type).map(
    ([field, definition]) => [field, compileDecoder(definition as WireType, `${path}.${field}`)] as const,
  );
  return (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid row in ${path}`);
    const row = value as Record<string, unknown>;
    if (Object.keys(row).length !== fields.length) throw new Error(`Unexpected fields in ${path}`);
    return Object.freeze(Object.fromEntries(fields.map(([name, decode]) => [name, decode(row[name])])));
  };
}
