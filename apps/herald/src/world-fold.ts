import { toJsonValue, type ModelRegistry } from "./model-registry";
import type {
  DecodedRecord,
  DecodedWorldEvent,
  FoldChange,
  FoldCheckpoint,
  FoldCheckpointRow,
  FoldRow,
  GameSnapshot,
} from "./types";

interface StoredModelRow {
  key: DecodedRecord;
  value: DecodedRecord;
}

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
  const expectedModels = new Set(registry.persistent.map(({ definition }) => definition.name));
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

  constructor(registry: ModelRegistry, parent?: WorldFold) {
    this.registry = registry;
    this.parent = parent;
    registry.persistent.forEach(({ definition }) => this.rowsByModel.set(definition.name, new Map()));
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
      for (const row of model.rows) rows.set(row.entity_id, { key: row.key, value: row.value });
    }
    return fold;
  }

  public apply(event: DecodedWorldEvent): FoldChange | undefined {
    if (event.kind === "event") {
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

    if (event.kind === "delete") return { del: { key: event.entityId, model: event.model.name }, gameId };
    const current = this.storedRow(event.model.name, event.entityId)!;
    return {
      gameId,
      set: {
        key: event.entityId,
        model: event.model.name,
        value: asJsonRecord({ ...current.key, ...current.value }),
      },
    };
  }

  public checkpoint(): FoldCheckpoint {
    return {
      models: this.registry.persistent.map(({ definition }) => ({
        model: definition.name,
        rows: [...this.materializedRows(definition.name).entries()].map(checkpointRow).sort((left, right) => {
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

  public snapshot(gameIdInput: string | number | bigint, confirmedBlock: number): GameSnapshot {
    const gameId = BigInt(gameIdInput);
    const models = this.registry.persistent.map(({ definition }) => {
      const gameRows = [...this.materializedRows(definition.name).entries()]
        .filter(([, row]) => definition.s2Scope === "chain" || belongsToGame(row, gameId))
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

  public retainedRowCount(): number {
    return this.registry.persistent.reduce((total, { definition }) => {
      return total + this.materializedRows(definition.name).size;
    }, 0);
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
      [...this.materializedRows("BlitzSettlement").values()]
        .filter((row) => belongsToGame(row, gameId))
        .map((row) => row.key.player)
        .filter((player): player is string | number | bigint => ["string", "number", "bigint"].includes(typeof player))
        .map((player) => `0x${BigInt(player).toString(16)}`),
    );
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
}
