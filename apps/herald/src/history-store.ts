import { PointsLeaderboard } from "./points-leaderboard";
import { readPointsRegistration, type HeraldLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { Pool, type PoolClient } from "pg";

import type { HeraldGameSnapshot, HeraldHistoryPage, HeraldTransactionCount } from "@bibliothecadao/eternum/game-sync";

import { normalizeFelt, toJsonValue } from "./model-registry";
import type { DecodedRecord, DecodedWorldEvent, RpcReceipt } from "./types";
import {
  encodeHistoryCursor,
  resolveHistoryWindow,
  type HistoryPosition,
  type StoryHistoryQuery,
} from "./history-cursor";
import type { HeraldHistoryEvent, HeraldStoryHistoryPage } from "@bibliothecadao/eternum/game-sync";

interface StoredHistoryEvent {
  block_number: number;
  entity_id: string | null;
  event_index: number;
  game_id: string;
  model: string;
  owner: string | null;
  transaction_hash: string;
  transaction_index: number;
  value: Record<string, unknown>;
}

export interface HistoryQuery {
  entityId?: string;
  gameId: string;
  limit: number;
  model?: string;
  story?: string;
  offset: number;
  owner?: string;
}

const scalarString = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") return null;
  try {
    return BigInt(value).toString();
  } catch {
    return null;
  }
};

const addressString = (value: unknown): string | null => {
  const scalar = scalarString(value);
  return scalar === null ? null : normalizeFelt(scalar);
};

const jsonRecord = (value: unknown): Record<string, unknown> => {
  const converted = toJsonValue(value);
  if (typeof converted !== "object" || converted === null || Array.isArray(converted)) {
    throw new Error("Herald history event did not serialize to an object");
  }
  return converted as Record<string, unknown>;
};

const storedHistoryEvent = (event: DecodedWorldEvent): StoredHistoryEvent | null => {
  if (event.kind !== "event" || event.position.blockNumber === null) return null;
  const value = jsonRecord({ ...event.key, ...event.value });
  const gameId = scalarString(event.key.game_id);
  if (!gameId && event.model.name === "StoryEvent") throw new Error("StoryEvent is missing game_id");
  if (!gameId) return null;

  return {
    block_number: event.position.blockNumber,
    entity_id: scalarString(value.entity_id),
    event_index: event.position.eventIndex,
    game_id: gameId,
    model: event.model.name,
    owner: addressString(value.owner),
    transaction_hash: normalizeFelt(event.position.transactionHash),
    transaction_index: event.position.transactionIndex,
    value,
  };
};

export class HistoryStore {
  private readonly pool: Pool;
  private readonly points = new PointsLeaderboard();
  private leaderboardReady = false;
  private writeQueue = Promise.resolve();
  private writeFailure?: Error;
  private historyWrites = Promise.resolve();
  private backfillComplete = false;
  private liveCompleteThroughBlock: number | undefined;
  private liveHistoryComplete = true;

  constructor(
    databaseUrl: string,
    private readonly chain: string,
    private readonly worldAddress: string,
  ) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 2 });
  }

  public async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS herald_history_events (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        model TEXT NOT NULL,
        game_id NUMERIC NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash TEXT NOT NULL,
        transaction_index INTEGER NOT NULL,
        event_index INTEGER NOT NULL,
        owner TEXT,
        entity_id NUMERIC,
        value JSONB NOT NULL,
        PRIMARY KEY (chain, world_address, transaction_hash, event_index)
      );
      CREATE INDEX IF NOT EXISTS herald_history_game_model_position
        ON herald_history_events (chain, world_address, game_id, model, block_number DESC, transaction_index DESC, event_index DESC);
      CREATE INDEX IF NOT EXISTS herald_history_story_variant
        ON herald_history_events USING GIN ((value->'story'));
      CREATE INDEX IF NOT EXISTS herald_history_game_owner_position
        ON herald_history_events (chain, world_address, game_id, owner, block_number DESC, transaction_index DESC, event_index DESC);
      CREATE INDEX IF NOT EXISTS herald_history_game_entity_position
        ON herald_history_events (chain, world_address, game_id, entity_id, block_number DESC, transaction_index DESC, event_index DESC);
      CREATE INDEX IF NOT EXISTS herald_story_history_position
        ON herald_history_events (chain, world_address, block_number, transaction_index, event_index)
        WHERE model = 'StoryEvent';

      CREATE TABLE IF NOT EXISTS herald_history_progress (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        complete_through_block BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (chain, world_address)
      );
      -- Older markers could advance ahead of startup backfill. Validate their prefix once before cursor reads.
      ALTER TABLE herald_history_progress ADD COLUMN IF NOT EXISTS contiguous BOOLEAN NOT NULL DEFAULT false;

      CREATE TABLE IF NOT EXISTS herald_game_transactions (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        game_id NUMERIC NOT NULL,
        transaction_hash TEXT NOT NULL,
        block_number BIGINT,
        status TEXT NOT NULL,
        PRIMARY KEY (chain, world_address, game_id, transaction_hash)
      );

      CREATE TABLE IF NOT EXISTS herald_game_review_snapshots (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        game_id NUMERIC NOT NULL,
        confirmed_block BIGINT NOT NULL,
        snapshot JSONB NOT NULL,
        frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (chain, world_address, game_id)
      );
    `);
    await this.restorePointsLeaderboard();
  }

  public appendEvents(
    events: readonly DecodedWorldEvent[],
    completeThroughBlock?: number,
    decodedCompletely = true,
  ): Promise<void> {
    return this.enqueueHistoryWrite(async () => {
      this.liveHistoryComplete &&= decodedCompletely;
      await this.persistHistoryBatch(
        events,
        this.backfillComplete && this.liveHistoryComplete ? completeThroughBlock : undefined,
      );
      if (completeThroughBlock !== undefined && this.liveHistoryComplete) {
        this.liveCompleteThroughBlock = Math.max(this.liveCompleteThroughBlock ?? -1, completeThroughBlock);
      }
    });
  }

  public appendBackfilledEvents(events: readonly DecodedWorldEvent[], completeThroughBlock: number): Promise<void> {
    return this.enqueueHistoryWrite(() => this.persistHistoryBatch(events, completeThroughBlock));
  }

  /** The queue fences backfill completion against live batches that are still committing. */
  public completeHistoryBackfill(throughBlock: number): Promise<void> {
    return this.enqueueHistoryWrite(async () => {
      await this.persistHistoryBatch([], Math.max(throughBlock, this.liveCompleteThroughBlock ?? -1));
      this.backfillComplete = true;
    });
  }

  private enqueueHistoryWrite(write: () => Promise<void>): Promise<void> {
    const result = this.historyWrites.then(write);
    // The caller receives the rejection; a failed backfill must not stop live history from being stored.
    this.historyWrites = result.catch(() => {});
    return result;
  }

  private async persistHistoryBatch(
    events: readonly DecodedWorldEvent[],
    completeThroughBlock?: number,
  ): Promise<void> {
    const rows = events.flatMap((event) => {
      const stored = storedHistoryEvent(event);
      return stored ? [stored] : [];
    });
    if (rows.length === 0 && completeThroughBlock === undefined) return;

    const client = await this.pool.connect();
    let registrations: Array<{ gameId: string; points: NonNullable<ReturnType<typeof readPointsRegistration>> }> = [];
    try {
      await client.query("BEGIN");
      registrations = await this.insertNewHistory(client, rows);
      if (completeThroughBlock !== undefined) await this.advanceHistoryProgress(client, completeThroughBlock);
      await client.query("COMMIT");
      for (const registration of registrations) this.points.accept(registration.gameId, registration.points);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertNewHistory(client: PoolClient, rows: StoredHistoryEvent[]) {
    if (rows.length === 0) return [];
    const inserted = await client.query<Pick<StoredHistoryEvent, "game_id" | "value">>(
      `INSERT INTO herald_history_events (
             chain, world_address, model, game_id, block_number, transaction_hash,
             transaction_index, event_index, owner, entity_id, value
           )
           SELECT $1, $2, row.model, row.game_id::numeric, row.block_number, row.transaction_hash,
                  row.transaction_index, row.event_index, row.owner, row.entity_id::numeric, row.value
           FROM jsonb_to_recordset($3::jsonb) AS row(
             model text, game_id text, block_number bigint, transaction_hash text,
             transaction_index integer, event_index integer, owner text, entity_id text, value jsonb
           )
           ON CONFLICT DO NOTHING
           RETURNING game_id::text, value`,
      [this.chain, this.worldAddress, JSON.stringify(rows)],
    );
    return inserted.rows.flatMap((row) => {
      const points = readPointsRegistration(row.value);
      return points ? [{ gameId: row.game_id, points }] : [];
    });
  }

  private async advanceHistoryProgress(client: PoolClient, completeThroughBlock: number): Promise<void> {
    await client.query(
      `INSERT INTO herald_history_progress (chain, world_address, complete_through_block, contiguous, updated_at)
           VALUES ($1, $2, $3, true, now())
           ON CONFLICT (chain, world_address) DO UPDATE
           SET complete_through_block = CASE WHEN herald_history_progress.contiguous
                 THEN GREATEST(herald_history_progress.complete_through_block, EXCLUDED.complete_through_block)
                 ELSE EXCLUDED.complete_through_block END,
               contiguous = true,
               updated_at = now()`,
      [this.chain, this.worldAddress, completeThroughBlock],
    );
  }

  public markLeaderboardReady(): void {
    this.leaderboardReady = true;
  }

  public leaderboard(gameId: string): HeraldLeaderboard | null {
    return this.leaderboardReady ? this.points.snapshot(gameId) : null;
  }

  private async restorePointsLeaderboard(): Promise<void> {
    const result = await this.pool.query<{ game_id: string; value: Record<string, unknown> }>(
      `SELECT game_id::text, value FROM herald_history_events
       WHERE chain = $1 AND world_address = $2 AND model = 'StoryEvent'
         AND value->'story' ? 'PointsRegisteredStory'`,
      [this.chain, this.worldAddress],
    );
    for (const row of result.rows) {
      const registration = readPointsRegistration(row.value);
      if (registration) this.points.accept(row.game_id, registration);
    }
  }

  public recordTransaction(gameId: string, receipt: RpcReceipt): void {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.pool.query(
          `INSERT INTO herald_game_transactions (
             chain, world_address, game_id, transaction_hash, block_number, status
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (chain, world_address, game_id, transaction_hash) DO UPDATE
           SET block_number = EXCLUDED.block_number, status = EXCLUDED.status`,
          [
            this.chain,
            this.worldAddress,
            gameId,
            normalizeFelt(receipt.transaction_hash),
            receipt.block_number ?? null,
            receipt.execution_status === "REVERTED" ? "REVERTED" : receipt.finality_status,
          ],
        );
      })
      .catch((error) => {
        this.writeFailure = error instanceof Error ? error : new Error(String(error));
      });
  }

  public async freezeReviewSnapshot(snapshot: HeraldGameSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO herald_game_review_snapshots (
         chain, world_address, game_id, confirmed_block, snapshot
       ) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (chain, world_address, game_id) DO NOTHING`,
      [this.chain, this.worldAddress, snapshot.game_id, snapshot.confirmed_block, JSON.stringify(snapshot)],
    );
  }

  public async reviewSnapshot(gameId: string): Promise<HeraldGameSnapshot | null> {
    const result = await this.pool.query<{ snapshot: HeraldGameSnapshot }>(
      `SELECT snapshot
       FROM herald_game_review_snapshots
       WHERE chain = $1 AND world_address = $2 AND game_id = $3`,
      [this.chain, this.worldAddress, gameId],
    );
    return result.rows[0]?.snapshot ?? null;
  }

  public async historyProgress(): Promise<number | null> {
    const result = await this.pool.query<{ complete_through_block: string; contiguous: boolean }>(
      `SELECT complete_through_block, contiguous
       FROM herald_history_progress
       WHERE chain = $1 AND world_address = $2`,
      [this.chain, this.worldAddress],
    );
    const value = result.rows[0]?.contiguous ? result.rows[0].complete_through_block : undefined;
    return value === undefined ? null : Number(value);
  }

  public async queryEvents(query: HistoryQuery): Promise<HeraldHistoryPage> {
    const filters = ["chain = $1", "world_address = $2", "game_id = $3"];
    const values: unknown[] = [this.chain, this.worldAddress, query.gameId];
    const addFilter = (sql: string, value: unknown) => {
      values.push(value);
      filters.push(sql.replace("$value", `$${values.length}`));
    };
    if (query.model) addFilter("model = $value", query.model);
    if (query.story) addFilter("value->'story' ? $value", query.story);
    if (query.owner) addFilter("owner = $value", normalizeFelt(query.owner));
    if (query.entityId) addFilter("entity_id = $value", BigInt(query.entityId).toString());

    const where = filters.join(" AND ");
    const countResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM herald_history_events WHERE ${where}`,
      values,
    );
    values.push(query.limit, query.offset);
    const rows = await this.pool.query<{
      block_number: string;
      event_index: number;
      game_id: string;
      model: string;
      transaction_hash: string;
      transaction_index: number;
      value: DecodedRecord;
    }>(
      `SELECT block_number, event_index, game_id::text, model, transaction_hash, transaction_index, value
       FROM herald_history_events
       WHERE ${where}
       ORDER BY block_number DESC, transaction_index DESC, event_index DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      complete_through_block: await this.historyProgress(),
      items: rows.rows.map((row) => ({
        ...row,
        block_number: Number(row.block_number),
        game_id: row.game_id,
        value: row.value,
      })),
      limit: query.limit,
      offset: query.offset,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  public async queryStoryHistory(query: StoryHistoryQuery): Promise<HeraldStoryHistoryPage> {
    const complete = await this.historyProgress();
    const scope = { chain: this.chain, world: this.worldAddress };
    const window = resolveHistoryWindow(query, scope, complete);
    const rows = await this.readStoryHistoryWindow(window.after, window.through, query.limit + 1);
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const after: HistoryPosition =
      hasMore && last ? [last.block_number, last.transaction_index, last.event_index] : [window.through];
    return {
      chain: this.chain,
      world_address: this.worldAddress,
      complete_through_block: window.complete,
      through_block: window.through,
      items,
      has_more: hasMore,
      next_cursor: encodeHistoryCursor(scope, after, hasMore ? window.through : undefined),
    };
  }

  private async readStoryHistoryWindow(
    after: HistoryPosition,
    through: number,
    limit: number,
  ): Promise<HeraldHistoryEvent[]> {
    const values: Array<string | number> = [this.chain, this.worldAddress, through, ...after, limit];
    const lowerBound =
      after.length === 1 ? "block_number > $4" : "(block_number, transaction_index, event_index) > ($4, $5, $6)";
    const result = await this.pool.query<Omit<HeraldHistoryEvent, "block_number"> & { block_number: string }>(
      `SELECT block_number, event_index, game_id::text, model, transaction_hash, transaction_index, value
       FROM herald_history_events
       WHERE chain = $1 AND world_address = $2 AND model = 'StoryEvent'
         AND block_number <= $3 AND ${lowerBound}
       ORDER BY block_number, transaction_index, event_index
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({ ...row, block_number: Number(row.block_number) }));
  }

  public async transactionCount(gameId: string): Promise<HeraldTransactionCount> {
    const result = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM herald_game_transactions
       WHERE chain = $1 AND world_address = $2 AND game_id = $3`,
      [this.chain, this.worldAddress, gameId],
    );
    return { count: Number(result.rows[0]?.total ?? 0), game_id: gameId };
  }

  public async close(): Promise<void> {
    await this.historyWrites;
    await this.writeQueue;
    if (this.writeFailure) throw this.writeFailure;
    await this.pool.end();
  }
}
