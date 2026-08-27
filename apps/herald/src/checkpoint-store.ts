import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

import { Pool } from "pg";

import type { ModelRegistry } from "./model-registry";
import type { FoldCheckpoint } from "./types";
import { WorldFold } from "./world-fold";

const compress = promisify(gzip);
const decompress = promisify(gunzip);

interface CheckpointRow {
  confirmed_block: string;
  payload: Buffer;
}

export interface LoadedCheckpoint {
  confirmedBlock: number;
  fold: WorldFold;
}

export class CheckpointStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 2 });
  }

  public async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS herald_fold_checkpoints (
        chain TEXT NOT NULL,
        world_address TEXT NOT NULL,
        confirmed_block BIGINT NOT NULL,
        payload BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (chain, world_address)
      )
    `);
  }

  public async load(chain: string, registry: ModelRegistry): Promise<LoadedCheckpoint | undefined> {
    const result = await this.pool.query<CheckpointRow>(
      `SELECT confirmed_block, payload
       FROM herald_fold_checkpoints
       WHERE chain = $1 AND world_address = $2`,
      [chain, registry.worldAddress],
    );
    const row = result.rows[0];
    if (!row) return undefined;

    const checkpoint = JSON.parse((await decompress(row.payload)).toString("utf8")) as FoldCheckpoint;
    const confirmedBlock = Number(row.confirmed_block);
    if (!Number.isSafeInteger(confirmedBlock) || confirmedBlock < 0) {
      throw new Error(`Checkpoint has invalid confirmed block ${row.confirmed_block}`);
    }
    return { confirmedBlock, fold: WorldFold.restore(registry, checkpoint) };
  }

  public async save(chain: string, confirmedBlock: number, fold: WorldFold): Promise<void> {
    const checkpoint = fold.checkpoint();
    const payload = await compress(Buffer.from(JSON.stringify(checkpoint)));
    await this.pool.query(
      `INSERT INTO herald_fold_checkpoints (chain, world_address, confirmed_block, payload, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (chain, world_address) DO UPDATE
       SET confirmed_block = EXCLUDED.confirmed_block,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at`,
      [chain, checkpoint.world_address, confirmedBlock, payload],
    );
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
