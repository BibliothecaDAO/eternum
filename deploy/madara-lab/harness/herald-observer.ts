import { setTimeout as sleep } from "node:timers/promises";

export interface HeraldExplorer {
  alt: boolean;
  explorerId: string;
  owner: string;
  stamina: number;
  staminaUpdatedTick: number;
  x: number;
  y: number;
}

interface SnapshotModel {
  model: string;
  rows: Array<{ key: string; value: Record<string, unknown> }>;
}

interface SnapshotResponse {
  confirmed_block: number;
  models: SnapshotModel[];
}

const DEFAULT_POLL_MS = 100;

export class HeraldObserver {
  private readonly inFlightSnapshots = new Map<string, Promise<SnapshotResponse>>();

  constructor(
    private readonly baseUrl: string,
    private readonly chain: string,
    private readonly pollMs = DEFAULT_POLL_MS,
  ) {}

  async readModelRows(gameId: number, models: readonly string[]): Promise<Map<string, Record<string, unknown>[]>> {
    const uniqueModels = [...new Set(models)].sort();
    const snapshot = await this.readSnapshot(gameId, uniqueModels);
    const rowsByModel = new Map(snapshot.models.map(({ model, rows }) => [model, rows.map(({ value }) => value)]));
    for (const model of uniqueModels) {
      if (!rowsByModel.has(model)) throw new Error(`Herald snapshot omitted requested model ${model}`);
    }
    return rowsByModel;
  }

  async waitForModelRows(
    gameId: number,
    models: readonly string[],
    isReady: (rows: Map<string, Record<string, unknown>[]>) => boolean,
    timeoutMs: number,
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const rows = await this.readModelRows(gameId, models);
      if (isReady(rows)) return rows;
      await sleep(this.pollMs);
    }
    throw new Error(
      `Herald models ${models.join(", ")} did not reach the required state within ${timeoutMs / 1_000} seconds`,
    );
  }

  async readExplorers(gameId: number): Promise<HeraldExplorer[]> {
    const rows = await this.readRows(gameId, "ExplorerTroops");
    return rows.map(toExplorer);
  }

  async waitForExplorer(
    gameId: number,
    explorerId: string,
    previous: Pick<HeraldExplorer, "stamina" | "staminaUpdatedTick" | "alt" | "x" | "y">,
    acceptedBlock: number,
    timeoutMs: number,
  ): Promise<HeraldExplorer> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const snapshot = await this.readSnapshot(gameId, ["ExplorerTroops"]);
      const current = rowsForModel(snapshot, "ExplorerTroops")
        .map(toExplorer)
        .find((candidate) => candidate.explorerId === entityId(explorerId));
      if (snapshot.confirmed_block < acceptedBlock) {
        await sleep(this.pollMs);
        continue;
      }
      if (current && explorerChanged(previous, current)) return current;
      await sleep(this.pollMs);
    }
    throw new Error(`Explorer ${explorerId} did not change in Herald within ${timeoutMs / 1_000} seconds`);
  }

  private async readRows(gameId: number, model: string): Promise<Record<string, unknown>[]> {
    const rows = await this.readModelRows(gameId, [model]);
    return rows.get(model)!;
  }

  private readSnapshot(gameId: number, models: string[]): Promise<SnapshotResponse> {
    const key = `${gameId}:${models.join(",")}`;
    const existing = this.inFlightSnapshots.get(key);
    if (existing) return existing;

    const request = this.fetchSnapshot(gameId, models).finally(() => {
      this.inFlightSnapshots.delete(key);
    });
    this.inFlightSnapshots.set(key, request);
    return request;
  }

  private async fetchSnapshot(gameId: number, models: string[]): Promise<SnapshotResponse> {
    const url = new URL(this.baseUrl);
    const prefix = url.pathname.replace(/\/+$/, "");
    url.pathname = `${prefix}/${this.chain}/games/${gameId}/snapshot`;
    url.search = "";
    url.searchParams.set("models", models.join(","));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Herald snapshot returned ${response.status}: ${await response.text()}`);
    return (await response.json()) as SnapshotResponse;
  }
}

const rowsForModel = (snapshot: SnapshotResponse, model: string): Record<string, unknown>[] => {
  const rows = snapshot.models.find((candidate) => candidate.model === model)?.rows;
  if (!rows) throw new Error(`Herald snapshot omitted requested model ${model}`);
  return rows.map(({ value }) => value);
};

const entityId = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Invalid entity id ${String(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`Invalid entity id ${String(value)}`);
  return parsed.toString();
};

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Herald ${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const numeric = (value: unknown, field: string): number => {
  const parsed = Number(BigInt(value as string | number | bigint));
  if (!Number.isSafeInteger(parsed)) throw new Error(`Herald ${field} must be a safe integer`);
  return parsed;
};

const boolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") throw new Error(`Herald ${field} must be a boolean`);
  return value;
};

const toExplorer = (row: Record<string, unknown>): HeraldExplorer => {
  const troops = record(row.troops, "ExplorerTroops.troops");
  const stamina = record(troops.stamina, "ExplorerTroops.troops.stamina");
  const coord = record(row.coord, "ExplorerTroops.coord");
  return {
    alt: boolean(coord.alt, "ExplorerTroops.coord.alt"),
    explorerId: entityId(row.explorer_id),
    owner: entityId(row.owner),
    stamina: numeric(stamina.amount, "ExplorerTroops.troops.stamina.amount"),
    staminaUpdatedTick: numeric(stamina.updated_tick, "ExplorerTroops.troops.stamina.updated_tick"),
    x: numeric(coord.x, "ExplorerTroops.coord.x"),
    y: numeric(coord.y, "ExplorerTroops.coord.y"),
  };
};

const explorerChanged = (
  previous: Pick<HeraldExplorer, "stamina" | "staminaUpdatedTick" | "alt" | "x" | "y">,
  current: HeraldExplorer,
): boolean =>
  previous.alt !== current.alt ||
  previous.x !== current.x ||
  previous.y !== current.y ||
  previous.stamina !== current.stamina ||
  previous.staminaUpdatedTick !== current.staminaUpdatedTick;

/** Settlement rows carry structure_ids as an array; saved fixtures kept older string encodings of the same list. */
export function parseStructureIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(entityId);
  }
  if (typeof value !== "string") {
    throw new Error(`Unexpected settlement structure_ids value: ${String(value)}`);
  }

  try {
    const decoded = JSON.parse(value) as unknown;
    if (Array.isArray(decoded)) return decoded.map(entityId);
  } catch {
    // Preserve compatibility with historical string encodings in saved fixtures.
  }

  const ids = value.match(/0x[0-9a-f]+|\d+/gi)?.map(entityId) ?? [];
  if (ids.length === 0) {
    throw new Error(`Could not parse settlement structure_ids: ${value}`);
  }
  return ids;
}
