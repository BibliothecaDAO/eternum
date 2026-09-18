import type { Pool, PoolClient } from "pg";
import { normalizeAddress } from "./address";
import { SlotConflict, SlotNotFound, splitPlaytestRoster, type PlaytestSlot, type SlotStore } from "./slots";

const slotProjection = `SELECT s.name, s.closes_at, s.frozen_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'owner', r.owner, 'position', r.position, 'gameNumber', r.game_number
  ) ORDER BY r.position) FROM playtest_registrations r WHERE r.slot_name = s.name), '[]'::jsonb) AS registrations
  FROM playtest_slots s`;

interface SlotRow {
  name: string;
  closes_at: Date;
  frozen_at: Date | null;
  registrations: PlaytestSlot["registrations"];
}

const toSlot = (row: SlotRow): PlaytestSlot => ({
  name: row.name,
  closesAt: row.closes_at.toISOString(),
  frozenAt: row.frozen_at?.toISOString() ?? null,
  registrations: row.registrations,
});

async function readSlot(client: PoolClient, name: string): Promise<PlaytestSlot> {
  const result = await client.query<SlotRow>(`${slotProjection} WHERE s.name = $1`, [name]);
  if (!result.rows[0]) throw new SlotNotFound("Playtest slot not found");
  return toSlot(result.rows[0]);
}

async function lockSlot(client: PoolClient, name: string) {
  const locked = await client.query("SELECT name FROM playtest_slots WHERE name = $1 FOR UPDATE", [name]);
  if (!locked.rows[0]) throw new SlotNotFound("Playtest slot not found");
  const result = await client.query<{ frozen_at: Date | null; closed: boolean }>(
    "SELECT frozen_at, closes_at <= clock_timestamp() AS closed FROM playtest_slots WHERE name = $1",
    [name],
  );
  return result.rows[0]!;
}

export class PostgresSlotStore implements SlotStore {
  constructor(private readonly pool: Pool) {}

  async create(name: string, closesAt: string): Promise<PlaytestSlot> {
    return this.transaction(async (client) => {
      await client.query(
        `INSERT INTO playtest_slots (name, closes_at)
         SELECT $1, $2::timestamptz WHERE $2::timestamptz > clock_timestamp()
         ON CONFLICT (name) DO NOTHING`,
        [name, closesAt],
      );
      const existing = await client.query<{ closes_at: Date }>("SELECT closes_at FROM playtest_slots WHERE name = $1", [
        name,
      ]);
      if (!existing.rows[0]) throw new SlotConflict("Registration deadline has passed");
      if (existing.rows[0].closes_at.getTime() !== Date.parse(closesAt)) {
        throw new SlotConflict("Slot schedule is immutable");
      }
      return readSlot(client, name);
    });
  }

  async list(): Promise<PlaytestSlot[]> {
    const result = await this.pool.query<SlotRow>(`${slotProjection} ORDER BY s.closes_at, s.name`);
    return result.rows.map(toSlot);
  }

  async register(name: string, owner: string): Promise<PlaytestSlot> {
    const address = normalizeAddress(owner);
    if (BigInt(address) === 0n) throw new SlotConflict("A bound identity is required");
    return this.transaction(async (client) => {
      const slot = await lockSlot(client, name);
      if (slot.closed || slot.frozen_at) throw new SlotConflict("Registration is closed");
      await client.query(
        `INSERT INTO playtest_registrations (slot_name, owner) VALUES ($1, $2)
         ON CONFLICT (slot_name, owner) DO NOTHING`,
        [name, address],
      );
      return readSlot(client, name);
    });
  }

  async freeze(name: string): Promise<PlaytestSlot> {
    return this.transaction(async (client) => {
      const locked = await lockSlot(client, name);
      if (locked.frozen_at) return readSlot(client, name);
      if (!locked.closed) throw new SlotConflict("Registration is still open");
      const slot = await readSlot(client, name);
      const assignments = splitPlaytestRoster(slot.registrations).flatMap((group, index) =>
        group.map(({ owner }) => ({ owner, game_number: index + 1 })),
      );
      await client.query(
        `UPDATE playtest_registrations r SET game_number = a.game_number
         FROM jsonb_to_recordset($2::jsonb) AS a(owner text, game_number integer)
         WHERE r.slot_name = $1 AND r.owner = a.owner`,
        [name, JSON.stringify(assignments)],
      );
      await client.query("UPDATE playtest_slots SET frozen_at = clock_timestamp() WHERE name = $1", [name]);
      return readSlot(client, name);
    });
  }

  async freezeNextDue(): Promise<void> {
    const result = await this.pool.query<{ name: string }>(
      `SELECT name FROM playtest_slots WHERE frozen_at IS NULL AND closes_at <= clock_timestamp()
       ORDER BY closes_at, name LIMIT 1`,
    );
    if (result.rows[0]) await this.freeze(result.rows[0].name);
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
