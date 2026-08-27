import { toJsonValue, type ModelRegistry } from "./model-registry";
import type { DecodedRecord, DecodedWorldEvent, FoldRow, GameSnapshot } from "./types";

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

export class WorldFold {
  private readonly registry: ModelRegistry;
  private readonly rowsByModel = new Map<string, Map<string, StoredModelRow>>();

  constructor(registry: ModelRegistry) {
    this.registry = registry;
    registry.persistent.forEach(({ definition }) => this.rowsByModel.set(definition.name, new Map()));
  }

  public apply(event: DecodedWorldEvent): void {
    if (event.kind === "event") return;

    const rows = this.rowsByModel.get(event.model.name);
    if (!rows) throw new Error(`Store event ${event.model.name} is not a persistent sync model`);

    if (event.kind === "set") {
      rows.set(event.entityId, { key: event.key, value: event.value });
      return;
    }
    if (event.kind === "delete") {
      rows.delete(event.entityId);
      return;
    }

    const existing = rows.get(event.entityId);
    if (!existing) {
      throw new Error(`${event.kind} for ${event.model.name}:${event.entityId} has no preceding StoreSetRecord`);
    }
    if (event.kind === "update") {
      rows.set(event.entityId, { key: existing.key, value: event.value });
      return;
    }
    rows.set(event.entityId, {
      key: existing.key,
      value: { ...existing.value, [event.member]: event.value },
    });
  }

  public snapshot(gameIdInput: string | number | bigint, confirmedBlock: number): GameSnapshot {
    const gameId = BigInt(gameIdInput);
    const models = this.registry.persistent.map(({ definition }) => {
      const rows = this.rowsByModel.get(definition.name);
      if (!rows) throw new Error(`Fold has no row collection for ${definition.name}`);
      const gameRows = [...rows.entries()]
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
    return [...this.rowsByModel.values()].reduce((total, rows) => total + rows.size, 0);
  }
}
