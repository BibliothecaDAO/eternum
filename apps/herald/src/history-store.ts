import { Pool } from "pg";

import type { HeraldGameSnapshot, HeraldHistoryPage, HeraldTransactionCount } from "@bibliothecadao/eternum/game-sync";

import { normalizeFelt, toJsonValue } from "./model-registry";
import type { DecodedRecord, DecodedWorldEvent, RpcReceipt } from "./types";

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
  private writeQueue = Promise.resolve();
  private writeFailure?: Error;

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
      CREATE INDEX IF NOT EXISTS herald_history_game_owner_position
        ON herald_history_events (chain, world_address, game_id, owner, block_number DESC, transaction_index DESC, event_index DESC);
      CREATE INDEX IF NOT EXISTS herald_history_game_entity_position
        ON herald_history_events (chain, world_address, game_id, entity_id, block_number DESC, transaction_index DESC, event_index DESC);

      CREATE TABLE IF NOT EXISTS herald_history_progress (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        complete_through_block BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (chain, world_address)
      );

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
  }

  public async appendEvents(events: readonly DecodedWorldEvent[], completeThroughBlock?: number): Promise<void> {
    const rows = events.flatMap((event) => {
      const stored = storedHistoryEvent(event);
      return stored ? [stored] : [];
    });
    if (rows.length === 0 && completeThroughBlock === undefined) return;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (rows.length > 0) {
        await client.query(
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
           ON CONFLICT DO NOTHING`,
          [this.chain, this.worldAddress, JSON.stringify(rows)],
        );
      }
      if (completeThroughBlock !== undefined) {
        await client.query(
          `INSERT INTO herald_history_progress (chain, world_address, complete_through_block, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (chain, world_address) DO UPDATE
           SET complete_through_block = GREATEST(
                 herald_history_progress.complete_through_block,
                 EXCLUDED.complete_through_block
               ),
               updated_at = now()`,
          [this.chain, this.worldAddress, completeThroughBlock],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
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
    const result = await this.pool.query<{ complete_through_block: string }>(
      `SELECT complete_through_block
       FROM herald_history_progress
       WHERE chain = $1 AND world_address = $2`,
      [this.chain, this.worldAddress],
    );
    const value = result.rows[0]?.complete_through_block;
    return value === undefined ? null : Number(value);
  }

  public async queryEvents(query: HistoryQuery): Promise<HeraldHistoryPage> {
    const filters = ["chain = $1", "world_address = $2", "game_id = $3"];
    const values: unknown[] = [this.chain, this.worldAddress, query.gameId];
    const addFilter = (sql: string, value: unknown) => {
      values.push(value);
      filters.push(sql.replace("?", `$${values.length}`));
    };
    if (query.model) addFilter("model = ?", query.model);
    if (query.owner) addFilter("owner = ?", normalizeFelt(query.owner));
    if (query.entityId) addFilter("entity_id = ?", BigInt(query.entityId).toString());

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
    await this.writeQueue;
    if (this.writeFailure) throw this.writeFailure;
    await this.pool.end();
  }
}
