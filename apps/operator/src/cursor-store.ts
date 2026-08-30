import { Pool } from "pg";
import type { CursorStore } from "./types";

export class PostgresCursorStore implements CursorStore {
  private readonly pool: Pool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 2 });
  }

  public async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS operator_cursors (
        stream TEXT PRIMARY KEY,
        next_block BIGINT NOT NULL CHECK (next_block >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async read(stream: string, initialNextBlock: number): Promise<number> {
    const result = await this.pool.query<{ next_block: string }>(
      `
        INSERT INTO operator_cursors (stream, next_block)
        VALUES ($1, $2)
        ON CONFLICT (stream) DO UPDATE SET stream = EXCLUDED.stream
        RETURNING next_block
      `,
      [stream, initialNextBlock],
    );
    return parseBlock(result.rows[0]?.next_block, stream);
  }

  public async advance(stream: string, nextBlock: number): Promise<void> {
    const result = await this.pool.query(
      `
        UPDATE operator_cursors
        SET next_block = $2, updated_at = NOW()
        WHERE stream = $1 AND next_block <= $2
        RETURNING stream
      `,
      [stream, nextBlock],
    );
    if (result.rowCount !== 1) throw new Error(`Refused to move operator cursor ${stream} backwards`);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

function parseBlock(value: string | undefined, stream: string): number {
  if (value === undefined) throw new Error(`Operator cursor ${stream} was not returned`);
  const block = Number(value);
  if (!Number.isSafeInteger(block) || block < 0) throw new Error(`Operator cursor ${stream} is invalid: ${value}`);
  return block;
}
