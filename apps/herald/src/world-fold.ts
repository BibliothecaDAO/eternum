import { hash } from "starknet";
import { normalizeFelt, toJsonValue, type ModelRegistry } from "./model-registry";
import type {
  DecodedRecord,
  DecodedWorldEvent,
  FoldChange,
  FoldCheckpoint,
  FoldCheckpointRow,
  FoldRow,
  FoldSet,
  GameSnapshot,
} from "./types";

interface StoredModelRow {
  key: DecodedRecord;
  value: DecodedRecord;
}

const persistentModelNames = (registry: ModelRegistry): readonly string[] => [
  ...registry.persistent.map(({ definition }) => definition.name),
];

const asJsonRecord = (value: DecodedRecord): DecodedRecord => {
  const jsonValue = toJsonValue(value);
  if (typeof jsonValue !== "object" || jsonValue === null || Array.isArray(jsonValue)) {
    throw new Error("Decoded model did not serialize to a JSON object");
  }
  return jsonValue as DecodedRecord;
};

const compareEntityKeys = (left: FoldRow, right: FoldRow): number => {
  const leftKey = BigInt(left.key);
  const rightKey = BigInt(right.key);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const belongsToGame = (row: StoredModelRow, gameId: bigint): boolean => {
  const value = row.key.game_id;
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new Error("Game-scoped model row has no scalar game_id key");
  }
  return BigInt(value) === gameId;
};

const scalarGameId = (key: DecodedRecord, model: string): string => {
  const value = key.game_id;
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Game-scoped model ${model} has no scalar game_id key`);
  }
  return BigInt(value).toString();
};

const checkpointRow = ([entityId, row]: [string, StoredModelRow]): FoldCheckpointRow => ({
  entity_id: entityId,
  key: asJsonRecord(row.key),
  value: asJsonRecord(row.value),
});

/**
 * A checkpoint is only restorable when it was folded from exactly the registry's persistent model set: a model added
 * to the sync manifest has rows in history the checkpoint never saw, so the fold must be rebuilt from genesis.
 * Returns the human-readable difference, or undefined when the sets match.
 */
export const checkpointModelMismatch = (registry: ModelRegistry, checkpoint: FoldCheckpoint): string | undefined => {
  if (registry.nativeSchemaIdentity !== checkpoint.native_schema_identity) return "native schema identity differs";
  const expectedModels = new Set(persistentModelNames(registry));
  const restoredModels = new Set(checkpoint.models.map(({ model }) => model));
  const missing = [...expectedModels].filter((model) => !restoredModels.has(model));
  const unexpected = [...restoredModels].filter((model) => !expectedModels.has(model));
  if (missing.length === 0 && unexpected.length === 0) return undefined;
  return `missing=${missing.join(",") || "none"}, unexpected=${unexpected.join(",") || "none"}`;
};

// The client streams the snapshot into its store one model page at a time and renders from the first pages that
// carry the world's structures and explored tiles; those go first, the rest keep registry order.
const SNAPSHOT_STREAMING_PRIORITY: readonly string[] = ["TileOpt", "Structure"];

const orderSnapshotModelsForStreaming = <TDefinition extends { name: string }>(
  definitions: readonly TDefinition[],
): TDefinition[] => {
  const rank = (name: string) => {
    const index = SNAPSHOT_STREAMING_PRIORITY.indexOf(name);
    return index === -1 ? SNAPSHOT_STREAMING_PRIORITY.length : index;
  };
  return [...definitions].sort((left, right) => rank(left.name) - rank(right.name));
};

export class WorldFold {
  private readonly registry: ModelRegistry;

  private readonly parent?: WorldFold;

  private readonly rowsByModel = new Map<string, Map<string, StoredModelRow | null>>();

  private readonly entityIdsByGameByModel = new Map<string, Map<string, Set<string>>>();

  constructor(registry: ModelRegistry, parent?: WorldFold) {
    this.registry = registry;
    this.parent = parent;
    registry.persistent.forEach(({ definition }) => {
      this.rowsByModel.set(definition.name, new Map());
      if (definition.s2Scope === "game") this.entityIdsByGameByModel.set(definition.name, new Map());
    });
  }

  public static restore(registry: ModelRegistry, checkpoint: FoldCheckpoint): WorldFold {
    if (checkpoint.version !== 1) throw new Error(`Unsupported fold checkpoint version ${checkpoint.version}`);
    if (BigInt(checkpoint.world_address) !== BigInt(registry.worldAddress)) {
      throw new Error(`Checkpoint world ${checkpoint.world_address} does not match ${registry.worldAddress}`);
    }

    const fold = new this(registry);
    const mismatch = checkpointModelMismatch(registry, checkpoint);
    if (mismatch) throw new Error(`Checkpoint model mismatch; ${mismatch}`);

    for (const model of checkpoint.models) {
      const rows = fold.rowsByModel.get(model.model)!;
      for (const row of model.rows) {
        const stored = { key: row.key, value: row.value };
        rows.set(row.entity_id, stored);
        fold.addEntityToGameIndex(model.model, row.entity_id, stored);
      }
    }
    return fold;
  }

  public apply(event: DecodedWorldEvent, onDerivedRow?: (change: FoldChange) => void): FoldChange | undefined {
    if (event.kind === "event") {
      this.applyEventRows(event).forEach((change) => onDerivedRow?.(change));
      return {
        event: true,
        gameId: this.eventGameId(event),
        set: {
          key: event.entityId,
          model: event.model.name,
          value: asJsonRecord({ ...event.key, ...event.value }),
        },
      };
    }

    const rows = this.rowsByModel.get(event.model.name);
    if (!rows) throw new Error(`Store event ${event.model.name} is not a persistent sync model`);

    const existing = this.storedRow(event.model.name, event.entityId);
    if (event.kind === "delete" && !existing) return undefined;
    const gameId = event.model.s2Scope === "game" ? this.eventGameId(event, existing) : undefined;

    if (event.kind === "set") {
      rows.set(event.entityId, { key: event.key, value: event.value });
    } else if (event.kind === "delete") {
      if (this.parent) rows.set(event.entityId, null);
      else rows.delete(event.entityId);
    } else if (!existing) {
      throw new Error(`${event.kind} for ${event.model.name}:${event.entityId} has no preceding RowSet`);
    } else if (event.kind === "update") {
      rows.set(event.entityId, { key: existing.key, value: event.value });
    } else {
      rows.set(event.entityId, {
        key: existing.key,
        value: { ...existing.value, [event.member]: event.value },
      });
    }

    this.updateGameIndex(event.model.name, event.entityId, existing, rows.get(event.entityId) ?? undefined);

    if (event.kind === "delete") return { del: { key: event.entityId, model: event.model.name }, gameId };
    return { gameId, set: this.currentRow(event.model.name, event.entityId)! };
  }

  public currentRow(model: string, entityId: string): FoldSet | undefined {
    const row = this.storedRow(model, entityId);
    return row ? { key: entityId, model, value: asJsonRecord({ ...row.key, ...row.value }) } : undefined;
  }

  public checkpoint(): FoldCheckpoint {
    return {
      models: persistentModelNames(this.registry).map((model) => ({
        model,
        rows: [...this.materializedRows(model).entries()].map(checkpointRow).sort((left, right) => {
          const leftKey = BigInt(left.entity_id);
          const rightKey = BigInt(right.entity_id);
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        }),
      })),
      version: 1,
      native_schema_identity: this.registry.nativeSchemaIdentity,
      world_address: this.registry.worldAddress,
    };
  }

  public overlay(): WorldFold {
    return new WorldFold(this.registry, this);
  }

  public reviewSnapshot(gameId: string | number | bigint, confirmedBlock: number): GameSnapshot {
    return this.snapshot(gameId, confirmedBlock, persistentModelNames(this.registry));
  }

  public retainedRowCount(): number {
    return persistentModelNames(this.registry).reduce((total, model) => total + this.materializedRows(model).size, 0);
  }

  public modelRows(model: string): FoldRow[] {
    return [...this.materializedRows(model).entries()]
      .map(([key, row]) => ({ key, value: asJsonRecord({ ...row.key, ...row.value }) }))
      .sort(compareEntityKeys);
  }

  public gameIds(): readonly string[] {
    if (!this.rowsByModel.has("GameRegistry")) return [];
    return [...this.materializedRows("GameRegistry").values()]
      .map((row) => scalarGameId(row.key, "GameRegistry"))
      .sort((left, right) => Number(left) - Number(right));
  }

  public snapshot(
    gameId: string | number | bigint,
    confirmedBlock: number,
    models?: readonly string[],
    actor?: string,
  ): GameSnapshot {
    const snapshot = this.snapshotRows(gameId, confirmedBlock, models);
    if (actor === undefined) return snapshot;
    const account = BigInt(actor);
    if (account <= 0n || account >= (1n << 251n) - 256n) throw new Error("Invalid gameplay account");
    const nonces = snapshot.models.find(({ model }) => model === "ActionNonce");
    if (!nonces) throw new Error("Actor snapshot requires ActionNonce");
    const key = normalizeFelt(hash.computePoseidonHashOnElements([gameId, account]));
    if (!nonces.rows.some((row) => BigInt(row.key) === BigInt(key))) {
      // Complete confirmed history establishes the initial nonce; the overlay follows this snapshot.
      nonces.rows.push({ key, value: { game_id: BigInt(gameId).toString(), actor, next_nonce: "0" } });
    }
    return snapshot;
  }

  public finalizedGameIds(): readonly string[] {
    return this.modelRows("GameRegistry")
      .filter(({ value }) => value.settled === true)
      .map(({ value }) => BigInt(value.game_id as string).toString());
  }

  public gameplayAccounts(gameId: string | number | bigint): ReadonlySet<string> {
    return new Set(
      this.modelRows("PlayerEntry")
        .filter(({ value }) => BigInt(value.game_id as string) === BigInt(gameId))
        .map(({ value }) => `0x${BigInt(value.player as string).toString(16)}`),
    );
  }

  private snapshotRows(
    gameIdInput: string | number | bigint,
    confirmedBlock: number,
    requestedModels?: readonly string[],
    _actor?: string,
  ): GameSnapshot {
    const gameId = BigInt(gameIdInput);
    const definitions = this.snapshotDefinitions(requestedModels);
    const models = definitions.map((definition) => {
      const rows =
        definition.s2Scope === "chain"
          ? this.materializedRows(definition.name)
          : this.materializedGameRows(definition.name, gameId);
      const gameRows = [...rows.entries()]
        .map(([key, row]): FoldRow => ({ key, value: asJsonRecord({ ...row.key, ...row.value }) }))
        .sort(compareEntityKeys);
      return { model: definition.name, rows: gameRows };
    });

    return {
      game_id: gameId.toString(),
      confirmed_block: confirmedBlock,
      models,
    };
  }

  private snapshotDefinitions(requestedModels?: readonly string[]) {
    const definitions = [...this.registry.persistent.map(({ definition }) => definition)];
    if (!requestedModels || requestedModels.length === 0) {
      return orderSnapshotModelsForStreaming(this.registry.persistent.map(({ definition }) => definition));
    }

    const requested = new Set(requestedModels);
    const available = new Set(definitions.map(({ name }) => name));
    const missing = [...requested].filter((model) => !available.has(model));
    if (missing.length > 0) throw new Error(`Unknown snapshot models: ${missing.join(", ")}`);
    return orderSnapshotModelsForStreaming(definitions.filter(({ name }) => requested.has(name)));
  }

  private eventGameId(event: DecodedWorldEvent, existing?: StoredModelRow): string | undefined {
    if (event.model.s2Scope === "chain") return undefined;
    if (event.kind === "set" || event.kind === "event") return scalarGameId(event.key, event.model.name);
    if (!existing) {
      throw new Error(`${event.kind} for ${event.model.name}:${event.entityId} has no preceding RowSet`);
    }
    return scalarGameId(existing.key, event.model.name);
  }

  private storedRow(model: string, entityId: string): StoredModelRow | undefined {
    const rows = this.rowsByModel.get(model);
    if (!rows) return undefined;
    if (rows.has(entityId)) return rows.get(entityId) ?? undefined;
    return this.parent?.storedRow(model, entityId);
  }

  private materializedRows(model: string): Map<string, StoredModelRow> {
    const materialized = this.parent ? this.parent.materializedRows(model) : new Map<string, StoredModelRow>();
    const rows = this.rowsByModel.get(model);
    if (!rows) throw new Error(`Fold has no row collection for ${model}`);
    for (const [entityId, row] of rows) {
      if (row) materialized.set(entityId, row);
      else materialized.delete(entityId);
    }
    return materialized;
  }

  private materializedGameRows(model: string, gameId: bigint): Map<string, StoredModelRow> {
    const materialized = this.parent
      ? this.parent.materializedGameRows(model, gameId)
      : new Map<string, StoredModelRow>();
    const rows = this.rowsByModel.get(model);
    const entityIds = this.entityIdsByGameByModel.get(model)?.get(gameId.toString());
    if (!rows) throw new Error(`Fold has no row collection for ${model}`);
    if (!entityIds) return materialized;

    for (const entityId of entityIds) {
      const row = rows.get(entityId);
      if (row && belongsToGame(row, gameId)) materialized.set(entityId, row);
      else materialized.delete(entityId);
    }
    return materialized;
  }

  private updateGameIndex(
    model: string,
    entityId: string,
    previous: StoredModelRow | undefined,
    current: StoredModelRow | undefined,
  ): void {
    if (!this.entityIdsByGameByModel.has(model)) return;
    if (this.parent) {
      if (previous) this.addEntityToGameIndex(model, entityId, previous);
      if (current) this.addEntityToGameIndex(model, entityId, current);
      return;
    }

    if (previous) this.removeEntityFromGameIndex(model, entityId, previous);
    if (current) this.addEntityToGameIndex(model, entityId, current);
  }

  private addEntityToGameIndex(model: string, entityId: string, row: StoredModelRow): void {
    const games = this.entityIdsByGameByModel.get(model);
    if (!games) return;
    const gameId = scalarGameId(row.key, model);
    const entityIds = games.get(gameId) ?? new Set<string>();
    entityIds.add(entityId);
    games.set(gameId, entityIds);
  }

  private removeEntityFromGameIndex(model: string, entityId: string, row: StoredModelRow): void {
    const games = this.entityIdsByGameByModel.get(model);
    if (!games) return;
    const gameId = scalarGameId(row.key, model);
    const entityIds = games.get(gameId);
    if (!entityIds) return;
    entityIds.delete(entityId);
    if (entityIds.size === 0) games.delete(gameId);
  }

  private applyEventRows(event: Extract<DecodedWorldEvent, { kind: "event" }>): FoldChange[] {
    if (event.model.name !== "ExecutionRecorded") return [];
    const { game_id, actor, nonce, nonce_consumed, order, status, reason } = event.value;
    const game = BigInt(String(game_id));
    const account = BigInt(String(actor));
    const submitted = BigInt(String(nonce));
    const result = BigInt(String(status));
    const code = BigInt(String(reason));
    if (BigInt(String(order)) === 0n || !((result === 1n && code === 0n) || (result === 2n && code !== 0n)))
      throw new Error("Invalid native execution outcome");
    if (!nonce_consumed) return [];
    if (
      game === 0n ||
      game >= 1n << 32n ||
      account === 0n ||
      account >= (1n << 251n) - 256n ||
      submitted === (1n << 64n) - 1n
    )
      throw new Error("Invalid consumed native nonce");
    const codec = this.registry.persistent.find((codec) => codec.definition.name === "ActionNonce");
    if (!codec) throw new Error("Missing native nonce schema");
    const change = this.apply({
      kind: "set",
      model: codec.definition,
      entityId: normalizeFelt(hash.computePoseidonHashOnElements([game, account])),
      position: event.position,
      key: { game_id: game, actor: account },
      value: { next_nonce: submitted + 1n },
    });
    return change ? [change] : [];
  }
}
