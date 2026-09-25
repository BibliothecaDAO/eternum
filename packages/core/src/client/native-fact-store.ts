import { hasSingleTilePosition } from "./native-occupancy";
import {
  nativeFactModels,
  type NativeKeys,
  type NativeModelName,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import type {
  GameSyncEvent,
  GameSyncFact,
  GameSyncRetainedKeys,
  GameSyncSnapshotState,
  GameSyncStore,
} from "../sync/game-sync-types";
import { readExpeditionRules } from "../utils/expeditions";
import {
  deriveGameSyncScope,
  scopeInputKeys,
  rowInGameSyncScope,
  isExpeditionScopedModel,
  type GameSyncScope,
} from "../sync/model-manifest";

export type NativeFactResult<Row> = { known: Row; unknown?: never } | { known?: never; unknown: string };

type UnusedArmySlot = { unused: true; known?: never; unknown?: never };
type AbsenceResult<M extends NativeModelName> =
  | NativeFactResult<NativeRows[M]>
  | (M extends "ArmySlot" ? UnusedArmySlot : never);

interface DeclaredAbsence {
  value: string;
  parent?: NativeModelName;
  parentKeys?: Readonly<Record<string, string>>;
}

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
    absence?: DeclaredAbsence;
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
  private snapshot?: GameSyncSnapshotState;
  private scopeCache?: { revision: number; result: NativeFactResult<GameSyncScope> };

  /** Empty change lists notify readers that snapshot/clock gates changed, without inventing a fact. */
  setSnapshot(state: GameSyncSnapshotState): void {
    const before = this.snapshot;
    if (
      before &&
      before.gameId === state.gameId &&
      before.complete === state.complete &&
      before.actor === state.actor &&
      before.timestamp === state.timestamp
    )
      return;
    this.snapshot = { ...state };
    this.revision++;
    for (const listener of this.listeners) listener([]);
  }
  private revision = 0;
  getRevision = (): number => this.revision;

  private readonly models = new Map<NativeModelName, Map<string, StoredFact>>();
  private readonly wireKeys = new Map<NativeModelName, Map<string, string>>();
  private readonly gameKeys = new Map<string, Set<string>>();
  private readonly ownerKeys = new Map<string, Set<string>>();
  private readonly armyHomeKeys = new Map<string, Set<string>>();
  private readonly spatialKeys = new Map<string, Set<string>>();
  private readonly eventListeners = new Set<(event: GameSyncEvent) => void>();
  private readonly listeners = new Set<(changes: readonly NativeFactChange[]) => void>();

  get<M extends NativeModelName>(model: M, keys: NativeKeys[M]): NativeRows[M] | undefined {
    return this.models.get(model)?.get(factKey(model, keys))?.row as NativeRows[M] | undefined;
  }

  require<M extends NativeModelName>(model: M, keys: NativeKeys[M]): NativeRows[M] {
    const row = this.get(model, keys);
    if (!row) throw new Error(`Native ${model} is not synchronized`);
    return row;
  }

  requireOrAbsent<M extends NativeModelName>(model: M, keys: NativeKeys[M]): AbsenceResult<M>;
  requireOrAbsent<M extends NativeModelName>(
    model: M,
    keys: NativeKeys[M],
  ): NativeFactResult<NativeRows[M]> | UnusedArmySlot {
    const present = this.get(model, keys);
    if (present) return { known: present };
    const definition = definitions[model];
    const absence = definition.absence;
    if (absence?.value !== "zero" && absence?.value !== "unused") return { unknown: `UNDECLARED_ABSENCE: ${model}` };
    const unknown = this.absenceUnknown(model, keys, absence);
    if (unknown) return { unknown };
    if (absence.value === "unused") return { unused: true };
    return {
      known: decoders.get(model)!({
        ...Object.fromEntries(Object.entries(definition.fields).map(([field, type]) => [field, zeroValue(type)])),
        ...keys,
      }) as NativeRows[M],
    };
  }

  /** Derived once per fact/gate revision, through Herald's reader and scope rule. */
  subscriptionScope(): NativeFactResult<GameSyncScope> {
    if (this.scopeCache?.revision === this.revision) return this.scopeCache.result;
    const result = this.deriveSubscriptionScope();
    this.scopeCache = { revision: this.revision, result };
    return result;
  }

  private deriveSubscriptionScope(): NativeFactResult<GameSyncScope> {
    const snapshot = this.snapshot;
    if (!snapshot?.complete) return { unknown: "INCOMPLETE_SNAPSHOT" };
    if (snapshot.actor === undefined) return { unknown: "INCOMPLETE_ACTOR_SNAPSHOT" };
    try {
      const rules = readExpeditionRules(this, snapshot.gameId);
      if (rules && snapshot.timestamp === undefined) return { unknown: "UNKNOWN_SCOPE_CLOCK" };
      return {
        known: deriveGameSyncScope(
          snapshot.actor ?? undefined,
          snapshot.timestamp ?? 0,
          rules,
          (model, spacing, keys) => {
            const selected = new Set(keys);
            return [...this.inGame(model, snapshot.gameId)]
              .filter((row) => scopeInputKeys(model, row, spacing).some((key) => selected.has(key)))
              .map((row) => ({ value: row }));
          },
        ),
      };
    } catch (error) {
      return { unknown: `INCOMPLETE_SCOPE: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private absenceUnknown(model: NativeModelName, keys: object, absence: DeclaredAbsence): string | undefined {
    const key = keys as Record<string, number | bigint>;
    const snapshot = this.snapshot;
    if (!snapshot?.complete || snapshot.gameId !== key.game_id) return `INCOMPLETE_SNAPSHOT: ${model}`;
    if (snapshot.actor === undefined) return `INCOMPLETE_ACTOR_SNAPSHOT: ${model}`;
    // Actor/shared scopes do not use expedition time or facts.
    const result = isExpeditionScopedModel(model)
      ? this.subscriptionScope()
      : { known: { actor: snapshot.actor ?? undefined } };
    if (!result.known) return result.unknown;
    if (!rowInGameSyncScope(model, key, result.known)) return `OUTSIDE_SNAPSHOT_SCOPE: ${model}`;
    if (absence.parent) {
      const parentKeys = Object.fromEntries(
        Object.entries(absence.parentKeys!).map(([parent, child]) => [parent, key[child]]),
      );
      if (!this.get(absence.parent, parentKeys as NativeKeys[typeof absence.parent]))
        return `UNKNOWN_PARENT: ${model} requires ${absence.parent}`;
    }
    return undefined;
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

  *armiesAtHome(gameId: number, home: number): IterableIterator<NativeRows["ExplorerTroops"]> {
    for (const key of this.armyHomeKeys.get(`${gameId}:${home}`) ?? [])
      yield this.models.get("ExplorerTroops")!.get(key)!.row as NativeRows["ExplorerTroops"];
  }

  entityOccupancy(gameId: number, entityId: number): NativeRows["TileOccupancy"] | undefined {
    const keys = this.spatialKeys.get(`${gameId}:${entityId}`);
    if (!keys?.size) return undefined;
    if (keys.size !== 1) throw new Error(`Multiple native positions for entity ${gameId}:${entityId}`);
    const key = keys.values().next().value!;
    return this.models.get("TileOccupancy")!.get(key)!.row as NativeRows["TileOccupancy"];
  }

  subscribe(listener: (changes: readonly NativeFactChange[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** One write: every fact, then the removal of each retained model's rows the write does not keep. */
  applyFacts(facts: readonly GameSyncFact[], retain?: GameSyncRetainedKeys): void {
    const pending: PendingChanges = new Map();
    const assignedKeys = new Map<string, string>();
    for (const fact of facts) {
      const model = requireModel(fact.model);
      if (fact.value === null) this.stageRemoval(pending, model, wireId(fact.key));
      else this.stageFact(pending, assignedKeys, model, wireId(fact.key), fact.value);
    }
    for (const [name, keys] of retain ?? []) this.stageUnretained(pending, requireModel(name), keys);
    const changes = this.commit(pending);
    if (changes.length) {
      this.revision += 1;
      for (const listener of this.listeners) listener(changes);
    }
  }

  subscribeEvents(listener: (event: GameSyncEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // The runtime deduplicates effects; confirmation promotions only update its history callback.
  applyEvent(event: GameSyncEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }

  private stageFact(
    pending: PendingChanges,
    assignedKeys: Map<string, string>,
    model: NativeModelName,
    id: string,
    value: Record<string, unknown>,
  ): void {
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

  private stageUnretained(pending: PendingChanges, model: NativeModelName, retained: ReadonlySet<string>): void {
    const kept = new Set([...retained].map(wireId));
    for (const id of this.wireKeys.get(model)?.keys() ?? []) if (!kept.has(id)) this.stageRemoval(pending, model, id);
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
        if (previous && current && isSameFact(previous, current)) continue;
        this.index(model, key, previous, current);
        if (current) {
          values.set(key, { row: current, wireId: id });
          keys.set(id, key);
        } else {
          values.delete(key);
          keys.delete(id);
        }
        changes.push(Object.freeze({ model, key, previous, current }) as NativeFactChange);
      }
    }
    return Object.freeze(changes);
  }

  private index(model: NativeModelName, key: string, previous: Fact | undefined, current: Fact | undefined): void {
    if (definitions[model].scope === "game")
      updateMembership(
        this.gameKeys,
        key,
        previous && `${model}:${gameIdOf(previous)}`,
        current && `${model}:${gameIdOf(current)}`,
      );
    if (model === "Structure") {
      const before = previous as NativeRows["Structure"] | undefined;
      const after = current as NativeRows["Structure"] | undefined;
      updateMembership(
        this.ownerKeys,
        key,
        before && `${before.game_id}:${before.owner}`,
        after && `${after.game_id}:${after.owner}`,
      );
    }
    if (model === "ExplorerTroops") {
      const before = previous as NativeRows["ExplorerTroops"] | undefined;
      const after = current as NativeRows["ExplorerTroops"] | undefined;
      updateMembership(
        this.armyHomeKeys,
        key,
        before && `${before.game_id}:${before.owner}`,
        after && `${after.game_id}:${after.owner}`,
      );
    }
    if (model === "TileOccupancy") {
      const before = previous as NativeRows["TileOccupancy"] | undefined;
      const after = current as NativeRows["TileOccupancy"] | undefined;
      updateMembership(
        this.spatialKeys,
        key,
        before && hasSingleTilePosition(before) ? `${before.game_id}:${before.entity_id}` : undefined,
        after && hasSingleTilePosition(after) ? `${after.game_id}:${after.entity_id}` : undefined,
      );
    }
  }
}

/** Decoded rows hold primitives, bigints, frozen arrays and records; a redelivered row is no change. */
function isSameFact(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([field, value]) => isSameFact(value, (right as Record<string, unknown>)[field]))
  );
}

function updateMembership(
  index: Map<string, Set<string>>,
  key: string,
  previous: string | undefined,
  current: string | undefined,
): void {
  if (previous === current) return;
  if (previous !== undefined) updateIndex(index, previous, key, false);
  if (current !== undefined) updateIndex(index, current, key, true);
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

function zeroValue(type: WireType): unknown {
  if (type === "boolean") return false;
  if (typeof type === "string") return 0;
  if (Array.isArray(type)) return [];
  if ("option" in type) return null;
  if ("enum" in type) return (type.enum as readonly string[])[0];
  if ("variants" in type) {
    const [name, payload] = Object.entries(type.variants)[0];
    return { [name]: zeroValue(payload as WireType) };
  }
  return Object.fromEntries(Object.entries(type).map(([field, member]) => [field, zeroValue(member as WireType)]));
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
  if ("option" in type) {
    const item = compileDecoder(type.option as WireType, path);
    return (value) => (value === null ? null : item(value));
  }
  if ("enum" in type)
    return (value) => {
      if (typeof value !== "string" || !(type.enum as readonly string[]).includes(value))
        throw new Error(`Invalid enum in ${path}`);
      return value;
    };
  if ("variants" in type) {
    const variants = new Map(
      Object.entries(type.variants).map(([name, payload]) => [
        name,
        compileDecoder(payload as WireType, `${path}.${name}`),
      ]),
    );
    return (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1)
        throw new Error(`Invalid enum in ${path}`);
      const [name, payload] = Object.entries(value)[0];
      const decode = variants.get(name);
      if (!decode) throw new Error(`Invalid enum in ${path}`);
      return Object.freeze({ [name]: decode(payload) });
    };
  }
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
