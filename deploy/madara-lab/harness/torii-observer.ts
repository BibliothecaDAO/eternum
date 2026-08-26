import { setTimeout as sleep } from "node:timers/promises";

export interface ToriiIndexTimes {
  eventIndexedAt?: number;
  transactionIndexedAt?: number;
}

export interface IndexedExplorer {
  eventId: string;
  explorerId: string;
  owner: string;
  stamina: number;
  staminaUpdatedTick: number;
  x: number;
  y: number;
}

export interface IndexedResource {
  eventId: string;
  laborBalance: bigint;
  structureId: string;
  woodOutput: bigint;
}

interface PendingTransaction {
  deadline: number;
  resolve: (times: ToriiIndexTimes) => void;
  times: ToriiIndexTimes;
}

interface PendingExplorer {
  deadline: number;
  explorerId: string;
  gameId: number;
  previousEventId: string;
  reject: (error: Error) => void;
  resolve: (explorer: IndexedExplorer) => void;
}

interface PendingResource {
  deadline: number;
  gameId: number;
  previous: IndexedResource;
  reject: (error: Error) => void;
  resolve: (resource: IndexedResource) => void;
  structureId: string;
}

interface TransactionIndexRow {
  source: "events" | "transactions";
  transaction_hash: string;
}

interface ExplorerIndexRow {
  event_id: string;
  explorer_id: number | string;
  owner: number | string;
  stamina: number | string;
  stamina_tick: number | string;
  x: number;
  y: number;
}

interface ResourceIndexRow {
  event_id: string;
  labor_balance: number | string;
  structure_id: number | string;
  wood_output: number | string;
}

const DEFAULT_POLL_MS = 250;
const SQL_BATCH_SIZE = 64;

export class ToriiObserver {
  private explorerWaiters = new Map<string, PendingExplorer>();
  private polling?: Promise<void>;
  private resourceWaiters = new Map<string, PendingResource>();
  private transactionWaiters = new Map<string, PendingTransaction>();

  constructor(
    private readonly toriiSqlUrl: string,
    private readonly pollMs = DEFAULT_POLL_MS,
  ) {}

  waitForTransaction(transactionHash: string, timeoutMs: number): Promise<ToriiIndexTimes> {
    const hash = normalizeTransactionHash(transactionHash);
    if (this.transactionWaiters.has(hash)) throw new Error(`Transaction ${hash} is already being observed`);

    const result = new Promise<ToriiIndexTimes>((resolve) => {
      this.transactionWaiters.set(hash, { deadline: Date.now() + timeoutMs, resolve, times: {} });
    });
    this.startPolling();
    return result;
  }

  waitForExplorer(
    gameId: number,
    explorerId: string,
    previousEventId: string,
    timeoutMs: number,
  ): Promise<IndexedExplorer> {
    const key = explorerKey(gameId, explorerId);
    if (this.explorerWaiters.has(key)) throw new Error(`Explorer ${explorerId} is already being observed`);

    const result = new Promise<IndexedExplorer>((resolve, reject) => {
      this.explorerWaiters.set(key, {
        deadline: Date.now() + timeoutMs,
        explorerId,
        gameId,
        previousEventId,
        reject,
        resolve,
      });
    });
    this.startPolling();
    return result;
  }

  async readResource(gameId: number, structureId: string): Promise<IndexedResource> {
    const rows = await queryTorii<ResourceIndexRow>(this.toriiSqlUrl, buildResourceQuery(gameId, [structureId]));
    const row = rows[0];
    if (!row) throw new Error(`Resource ${structureId} in game ${gameId} is not indexed`);
    return toIndexedResource(row);
  }

  waitForResource(
    gameId: number,
    structureId: string,
    previous: IndexedResource,
    timeoutMs: number,
  ): Promise<IndexedResource> {
    const key = resourceKey(gameId, structureId);
    if (this.resourceWaiters.has(key)) throw new Error(`Resource ${structureId} is already being observed`);

    const result = new Promise<IndexedResource>((resolve, reject) => {
      this.resourceWaiters.set(key, {
        deadline: Date.now() + timeoutMs,
        gameId,
        previous,
        reject,
        resolve,
        structureId,
      });
    });
    this.startPolling();
    return result;
  }

  private startPolling(): void {
    if (this.polling) return;
    this.polling = Promise.resolve()
      .then(() => this.pollUntilIdle())
      .finally(() => {
        this.polling = undefined;
        if (this.hasWaiters()) this.startPolling();
      });
  }

  private async pollUntilIdle(): Promise<void> {
    while (this.hasWaiters()) {
      await Promise.allSettled([this.observeTransactions(), this.observeExplorers(), this.observeResources()]);
      this.expireWaiters();
      if (this.hasWaiters()) await sleep(this.pollMs);
    }
  }

  private hasWaiters(): boolean {
    return this.transactionWaiters.size > 0 || this.explorerWaiters.size > 0 || this.resourceWaiters.size > 0;
  }

  private async observeTransactions(): Promise<void> {
    const hashes = [...this.transactionWaiters.keys()];
    await Promise.all(chunks(hashes, SQL_BATCH_SIZE).map((batch) => this.observeTransactionBatch(batch)));
  }

  private async observeTransactionBatch(hashes: string[]): Promise<void> {
    if (hashes.length === 0) return;
    const values = hashes.map((hash) => `'${sqlHex(hash)}'`).join(", ");
    const rows = await queryTorii<TransactionIndexRow>(
      this.toriiSqlUrl,
      `SELECT transaction_hash, source FROM (
        SELECT transaction_hash, 'transactions' AS source FROM transactions WHERE transaction_hash IN (${values})
        UNION ALL
        SELECT transaction_hash, 'events' AS source FROM events WHERE transaction_hash IN (${values})
      ) GROUP BY transaction_hash, source`,
    );
    const observedAt = Date.now();

    for (const row of rows) {
      const hash = normalizeTransactionHash(row.transaction_hash);
      const waiter = this.transactionWaiters.get(hash);
      if (!waiter) continue;
      if (row.source === "transactions") waiter.times.transactionIndexedAt ??= observedAt;
      if (row.source === "events") waiter.times.eventIndexedAt ??= observedAt;
      if (waiter.times.transactionIndexedAt !== undefined && waiter.times.eventIndexedAt !== undefined) {
        this.transactionWaiters.delete(hash);
        waiter.resolve(waiter.times);
      }
    }
  }

  private async observeExplorers(): Promise<void> {
    const waiters = [...this.explorerWaiters.values()];
    const byGame = Map.groupBy(waiters, (waiter) => waiter.gameId);
    await Promise.all(
      [...byGame].map(async ([gameId, gameWaiters]) => {
        for (const batch of chunks(gameWaiters, SQL_BATCH_SIZE)) {
          await this.observeExplorerBatch(gameId, batch);
        }
      }),
    );
  }

  private async observeExplorerBatch(gameId: number, waiters: PendingExplorer[]): Promise<void> {
    if (waiters.length === 0) return;
    const ids = waiters.map(({ explorerId }) => sqlInteger(explorerId)).join(", ");
    const rows = await queryTorii<ExplorerIndexRow>(
      this.toriiSqlUrl,
      `SELECT internal_event_id AS event_id, explorer_id, owner,
        "troops.stamina.amount" AS stamina, "troops.stamina.updated_tick" AS stamina_tick,
        "coord.x" AS x, "coord.y" AS y
      FROM "s2-ExplorerTroops"
      WHERE game_id = ${sqlInteger(gameId)} AND explorer_id IN (${ids})`,
    );

    for (const row of rows) {
      const explorer = toIndexedExplorer(row);
      const key = explorerKey(gameId, explorer.explorerId);
      const waiter = this.explorerWaiters.get(key);
      if (!waiter || explorer.eventId === waiter.previousEventId) continue;
      this.explorerWaiters.delete(key);
      waiter.resolve(explorer);
    }
  }

  private async observeResources(): Promise<void> {
    const waiters = [...this.resourceWaiters.values()];
    const byGame = Map.groupBy(waiters, (waiter) => waiter.gameId);
    await Promise.all(
      [...byGame].map(async ([gameId, gameWaiters]) => {
        for (const batch of chunks(gameWaiters, SQL_BATCH_SIZE)) {
          await this.observeResourceBatch(gameId, batch);
        }
      }),
    );
  }

  private async observeResourceBatch(gameId: number, waiters: PendingResource[]): Promise<void> {
    if (waiters.length === 0) return;
    const rows = await queryTorii<ResourceIndexRow>(
      this.toriiSqlUrl,
      buildResourceQuery(
        gameId,
        waiters.map(({ structureId }) => structureId),
      ),
    );

    for (const row of rows) {
      const resource = toIndexedResource(row);
      const key = resourceKey(gameId, resource.structureId);
      const waiter = this.resourceWaiters.get(key);
      if (!waiter || resource.eventId === waiter.previous.eventId) continue;
      this.resourceWaiters.delete(key);
      if (!resourceChanged(waiter.previous, resource)) {
        waiter.reject(new Error(`Resource ${resource.structureId} was indexed without a labor or wood output delta`));
        continue;
      }
      waiter.resolve(resource);
    }
  }

  private expireWaiters(): void {
    const now = Date.now();
    for (const [hash, waiter] of this.transactionWaiters) {
      if (now <= waiter.deadline) continue;
      this.transactionWaiters.delete(hash);
      waiter.resolve(waiter.times);
    }
    for (const [key, waiter] of this.explorerWaiters) {
      if (now <= waiter.deadline) continue;
      this.explorerWaiters.delete(key);
      waiter.reject(
        new Error(`Explorer ${waiter.explorerId} did not update in Torii after its transaction was indexed`),
      );
    }
    for (const [key, waiter] of this.resourceWaiters) {
      if (now <= waiter.deadline) continue;
      this.resourceWaiters.delete(key);
      waiter.reject(
        new Error(`Resource ${waiter.structureId} did not change in Torii after its transaction was indexed`),
      );
    }
  }
}

export async function queryTorii<T>(toriiSqlUrl: string, query: string): Promise<T[]> {
  const url = new URL(toriiSqlUrl);
  url.searchParams.set("query", query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Torii SQL returned ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("Torii SQL response is not an array");
  return body as T[];
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function explorerKey(gameId: number, explorerId: string): string {
  return `${gameId}:${parseEntityId(explorerId)}`;
}

function resourceKey(gameId: number, structureId: string): string {
  return `${gameId}:${parseEntityId(structureId)}`;
}

function buildResourceQuery(gameId: number, structureIds: string[]): string {
  const ids = structureIds.map(sqlInteger).join(", ");
  return `SELECT internal_event_id AS event_id, entity_id AS structure_id,
    LABOR_BALANCE AS labor_balance, "WOOD_PRODUCTION.output_amount_left" AS wood_output
  FROM "s2-Resource"
  WHERE game_id = ${sqlInteger(gameId)} AND entity_id IN (${ids})`;
}

function normalizeTransactionHash(value: string): string {
  const digits = value.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(digits)) throw new Error(`Invalid transaction hash ${value}`);
  return `0x${digits.padStart(64, "0")}`;
}

function sqlHex(value: string): string {
  return normalizeTransactionHash(value);
}

function sqlInteger(value: number | string): string {
  const normalized = parseEntityId(value);
  if (!/^\d+$/.test(normalized)) throw new Error(`Invalid SQL integer ${String(value)}`);
  return normalized;
}

function parseEntityId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Invalid entity id ${String(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`Invalid entity id ${String(value)}`);
  return parsed.toString();
}

function toIndexedExplorer(row: ExplorerIndexRow): IndexedExplorer {
  return {
    eventId: row.event_id,
    explorerId: parseEntityId(row.explorer_id),
    owner: parseEntityId(row.owner),
    stamina: Number(row.stamina),
    staminaUpdatedTick: Number(row.stamina_tick),
    x: Number(row.x),
    y: Number(row.y),
  };
}

function toIndexedResource(row: ResourceIndexRow): IndexedResource {
  return {
    eventId: row.event_id,
    laborBalance: BigInt(row.labor_balance),
    structureId: parseEntityId(row.structure_id),
    woodOutput: BigInt(row.wood_output),
  };
}

function resourceChanged(previous: IndexedResource, current: IndexedResource): boolean {
  return previous.laborBalance !== current.laborBalance || previous.woodOutput !== current.woodOutput;
}
