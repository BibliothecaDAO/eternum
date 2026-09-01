import { toJsonValue, type ModelRegistry } from "./model-registry";
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

const LAST_BATTLE_MODEL = "LastBattle";

const persistentModelNames = (registry: ModelRegistry): readonly string[] => [
  ...registry.persistent.map(({ definition }) => definition.name),
  LAST_BATTLE_MODEL,
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
  const expectedModels = new Set(persistentModelNames(registry));
  const restoredModels = new Set(checkpoint.models.map(({ model }) => model));
  const missing = [...expectedModels].filter((model) => !restoredModels.has(model));
  const unexpected = [...restoredModels].filter((model) => !expectedModels.has(model));
  if (missing.length === 0 && unexpected.length === 0) return undefined;
  return `missing=${missing.join(",") || "none"}, unexpected=${unexpected.join(",") || "none"}`;
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
    this.rowsByModel.set(LAST_BATTLE_MODEL, new Map());
    this.entityIdsByGameByModel.set(LAST_BATTLE_MODEL, new Map());
  }

  public static restore(registry: ModelRegistry, checkpoint: FoldCheckpoint): WorldFold {
    if (checkpoint.version !== 1) throw new Error(`Unsupported fold checkpoint version ${checkpoint.version}`);
    if (BigInt(checkpoint.world_address) !== BigInt(registry.worldAddress)) {
      throw new Error(`Checkpoint world ${checkpoint.world_address} does not match ${registry.worldAddress}`);
    }

    const mismatch = checkpointModelMismatch(registry, checkpoint);
    if (mismatch) throw new Error(`Checkpoint model mismatch; ${mismatch}`);

    const fold = new WorldFold(registry);
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

  public apply(event: DecodedWorldEvent): FoldChange | undefined {
    if (event.kind === "event") {
      if (event.model.name === "BattleEvent") this.applyLastBattle(event);
      return {
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
    const gameId = event.model.s2Scope === "game" ? this.eventGameId(event, existing) : undefined;

    if (event.kind === "set") {
      rows.set(event.entityId, { key: event.key, value: event.value });
    } else if (event.kind === "delete") {
      if (this.parent) rows.set(event.entityId, null);
      else rows.delete(event.entityId);
    } else if (!existing) {
      throw new Error(`${event.kind} for ${event.model.name}:${event.entityId} has no preceding StoreSetRecord`);
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

  /** The row as a diff `set` would carry it, or undefined when neither this fold nor its parent holds it. */
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
      world_address: this.registry.worldAddress,
    };
  }

  public overlay(): WorldFold {
    return new WorldFold(this.registry, this);
  }

  public snapshot(
    gameIdInput: string | number | bigint,
    confirmedBlock: number,
    requestedModels?: readonly string[],
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

  public reviewSnapshot(gameId: string | number | bigint, confirmedBlock: number): GameSnapshot {
    return this.snapshot(gameId, confirmedBlock, persistentModelNames(this.registry));
  }

  private snapshotDefinitions(requestedModels?: readonly string[]) {
    const definitions = [
      ...this.registry.persistent.map(({ definition }) => definition),
      {
        name: LAST_BATTLE_MODEL,
        s2Scope: "game" as const,
      },
    ];
    if (!requestedModels || requestedModels.length === 0) {
      return this.registry.persistent.map(({ definition }) => definition);
    }

    const requested = new Set(requestedModels);
    const available = new Set(definitions.map(({ name }) => name));
    const missing = [...requested].filter((model) => !available.has(model));
    if (missing.length > 0) throw new Error(`Unknown snapshot models: ${missing.join(", ")}`);
    return definitions.filter(({ name }) => requested.has(name));
  }

  public retainedRowCount(): number {
    return persistentModelNames(this.registry).reduce((total, model) => total + this.materializedRows(model).size, 0);
  }

  public modelRows(model: string): FoldRow[] {
    return [...this.materializedRows(model).entries()]
      .map(([key, row]) => ({ key, value: asJsonRecord({ ...row.key, ...row.value }) }))
      .sort(compareEntityKeys);
  }

  public gameplayAccounts(gameIdInput: string | number | bigint): ReadonlySet<string> {
    if (!this.rowsByModel.has("BlitzSettlement")) return new Set();
    const gameId = BigInt(gameIdInput);
    return new Set(
      [...this.materializedGameRows("BlitzSettlement", gameId).values()]
        .map((row) => row.key.player)
        .filter((player): player is string | number | bigint => ["string", "number", "bigint"].includes(typeof player))
        .map((player) => `0x${BigInt(player).toString(16)}`),
    );
  }

  public gameIds(): readonly string[] {
    if (!this.rowsByModel.has("GameRegistry")) return [];
    return [...this.materializedRows("GameRegistry").values()]
      .map((row) => scalarGameId(row.key, "GameRegistry"))
      .sort((left, right) => Number(left) - Number(right));
  }

  public endedGameIds(): readonly string[] {
    if (!this.rowsByModel.has("GameRegistry")) return [];
    return [...this.materializedRows("GameRegistry").values()]
      .filter((row) => row.value.status === "Ended" || row.value.status === "Settled")
      .map((row) => scalarGameId(row.key, "GameRegistry"));
  }

  private applyLastBattle(event: Extract<DecodedWorldEvent, { kind: "event" }>): void {
    const gameId = scalarGameId(event.key, event.model.name);
    const attackerId = this.scalarBattleField(event.key.attacker_id, "attacker_id");
    const defenderId = this.scalarBattleField(event.key.defender_id, "defender_id");
    const timestamp = this.scalarBattleField(event.value.timestamp, "timestamp");

    this.updateLastBattleParticipant(gameId, defenderId, {
      latest_attacker_id: attackerId,
      latest_attack_timestamp: timestamp,
    });
    this.updateLastBattleParticipant(gameId, attackerId, {
      latest_defender_id: defenderId,
      latest_defense_timestamp: timestamp,
    });
  }

  private updateLastBattleParticipant(gameId: string, entityId: bigint, update: DecodedRecord): void {
    const rows = this.rowsByModel.get(LAST_BATTLE_MODEL)!;
    const storageKey = ((BigInt(gameId) << 128n) | entityId).toString();
    const existing = rows.get(storageKey);
    const row: StoredModelRow = {
      key: { game_id: BigInt(gameId), entity_id: entityId },
      value: { ...(existing?.value ?? {}), ...update },
    };
    rows.set(storageKey, row);
    this.addEntityToGameIndex(LAST_BATTLE_MODEL, storageKey, row);
  }

  private scalarBattleField(value: unknown, field: string): bigint {
    if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
      throw new Error(`BattleEvent.${field} is not a scalar`);
    }
    return BigInt(value);
  }

  private eventGameId(event: DecodedWorldEvent, existing?: StoredModelRow): string | undefined {
    if (event.model.s2Scope === "chain") return undefined;
    if (event.kind === "set" || event.kind === "event") return scalarGameId(event.key, event.model.name);
    if (!existing) {
      throw new Error(`${event.kind} for ${event.model.name}:${event.entityId} has no preceding StoreSetRecord`);
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
}
