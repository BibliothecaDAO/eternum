import type { ModelRegistry } from "./model-registry";
import type { GameSnapshot, SnapshotModel } from "./types";

interface ModelParityResult {
  herald_rows: number;
  matched: boolean;
  mismatch?: {
    entity: string;
    field: string;
    herald?: unknown;
    torii?: unknown;
  };
  model: string;
  torii_rows: number;
}

interface ParityReport {
  confirmed_block: number;
  game_id: string;
  matched: boolean;
  models: ModelParityResult[];
}

const assertModelName = (model: string): string => {
  if (!/^[A-Za-z0-9_]+$/.test(model)) throw new Error(`Unsafe Torii model name ${model}`);
  return model;
};

const normalizeEntityId = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Torii row has no internal_entity_id");
  const entityId = value.split(":").at(-1);
  if (!entityId) throw new Error(`Invalid Torii internal_entity_id ${value}`);
  return BigInt(entityId).toString();
};

const normalizeScalar = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "bigint" || typeof value === "number") return BigInt(value).toString();
  if (Array.isArray(value)) return value.map(normalizeScalar);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeScalar(entry)]),
    );
  }
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (/^-?[0-9]+$/.test(trimmed) || /^0x[0-9a-f]+$/i.test(trimmed)) return BigInt(trimmed).toString();
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return normalizeScalar(JSON.parse(trimmed));
    } catch {
      return value;
    }
  }
  return value;
};

export const flattenModelValue = (value: Record<string, unknown>): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};
  const visit = (entry: unknown, path: string): void => {
    if (Array.isArray(entry) || entry === null || typeof entry !== "object") {
      flattened[path] = normalizeScalar(entry);
      return;
    }
    const fields = Object.entries(entry as Record<string, unknown>);
    if (fields.length === 0) {
      flattened[path] = {};
      return;
    }
    fields.forEach(([field, child]) => visit(child, path ? `${path}.${field}` : field));
  };
  Object.entries(value).forEach(([field, entry]) => visit(entry, field));
  return Object.fromEntries(Object.entries(flattened).sort(([left], [right]) => left.localeCompare(right)));
};

const normalizeToriiRow = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([field]) => !field.startsWith("internal_"))
      .map(([field, value]) => [field, normalizeScalar(value)] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const rowMapFromHerald = (model: SnapshotModel): Map<string, Record<string, unknown>> =>
  new Map(model.rows.map((row) => [BigInt(row.key).toString(), flattenModelValue(row.value)]));

const rowMapFromTorii = (rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> =>
  new Map(rows.map((row) => [normalizeEntityId(row.internal_entity_id), normalizeToriiRow(row)]));

const findMismatch = (
  heraldRows: Map<string, Record<string, unknown>>,
  toriiRows: Map<string, Record<string, unknown>>,
): ModelParityResult["mismatch"] => {
  const entityIds = new Set([...heraldRows.keys(), ...toriiRows.keys()]);
  for (const entity of [...entityIds].sort((left, right) => (BigInt(left) < BigInt(right) ? -1 : 1))) {
    const herald = heraldRows.get(entity);
    const torii = toriiRows.get(entity);
    if (!herald || !torii) return { entity, field: "$row", herald: herald !== undefined, torii: torii !== undefined };
    const fields = new Set([...Object.keys(herald), ...Object.keys(torii)]);
    for (const field of [...fields].sort()) {
      if (JSON.stringify(herald[field]) !== JSON.stringify(torii[field])) {
        return { entity, field, herald: herald[field], torii: torii[field] };
      }
    }
  }
  return undefined;
};

export class ToriiOracle {
  private readonly sqlUrl: URL;

  constructor(baseUrl: string) {
    this.sqlUrl = new URL("sql", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  public async indexedBlock(): Promise<number> {
    const rows = await this.query("SELECT id FROM events ORDER BY id DESC LIMIT 1", "indexed block");
    const id = rows[0]?.id;
    if (typeof id !== "string") throw new Error("Torii has no indexed world event");
    const blockFelt = id.split(":")[0];
    return Number(BigInt(blockFelt));
  }

  public async modelRows(model: string, gameId?: string): Promise<Record<string, unknown>[]> {
    const safeModel = assertModelName(model);
    const where = gameId === undefined ? "" : ` WHERE game_id = ${BigInt(gameId).toString()}`;
    return this.query(`SELECT * FROM "s2-${safeModel}"${where}`, model);
  }

  private async query(sql: string, label: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(this.sqlUrl, {
      body: sql,
      headers: { "content-type": "text/plain" },
      method: "POST",
    });
    if (!response.ok)
      throw new Error(`Torii SQL for ${label} returned HTTP ${response.status}: ${await response.text()}`);
    const rows = (await response.json()) as unknown;
    if (!Array.isArray(rows)) throw new Error(`Torii SQL for ${label} did not return rows`);
    return rows as Record<string, unknown>[];
  }
}

export const compareSnapshotWithTorii = async (
  snapshot: GameSnapshot,
  registry: ModelRegistry,
  torii: ToriiOracle,
): Promise<ParityReport> => {
  const models: ModelParityResult[] = [];
  for (const model of snapshot.models) {
    const codec = registry.persistent.find(({ definition }) => definition.name === model.model);
    if (!codec) throw new Error(`Snapshot contains unregistered model ${model.model}`);
    const toriiRows = await torii.modelRows(
      model.model,
      codec.definition.s2Scope === "game" ? snapshot.game_id : undefined,
    );
    const heraldRowMap = rowMapFromHerald(model);
    const toriiRowMap = rowMapFromTorii(toriiRows);
    const mismatch = findMismatch(heraldRowMap, toriiRowMap);
    models.push({
      herald_rows: heraldRowMap.size,
      matched: mismatch === undefined,
      mismatch,
      model: model.model,
      torii_rows: toriiRowMap.size,
    });
  }
  return {
    confirmed_block: snapshot.confirmed_block,
    game_id: snapshot.game_id,
    matched: models.every(({ matched }) => matched),
    models,
  };
};
