import type { BlitzValuePort } from "./paid-blitz";
import type { D1LaunchStore } from "./store";
import { SlotNotFound, type PlaytestSlot, type SlotStore } from "./slots";

const SELECT_SLOTS = "SELECT * FROM playtest_slots";

interface SlotRow {
  chain_id: string;
  slot_id: number;
  name: string;
  closes_at: number;
}

/** D1 stores scheduling metadata only; paid player ownership never lives in this database. */
export class D1SlotStore implements SlotStore {
  constructor(
    private readonly db: D1Database,
    private readonly launches: D1LaunchStore,
    private readonly value: BlitzValuePort,
  ) {}

  async get(name: string): Promise<PlaytestSlot> {
    const row = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? AND name=?`)
      .bind(await this.launches.targetChain(), name)
      .first<SlotRow>();
    if (!row) throw new SlotNotFound("Slot not found");
    return toSlot(row, Date.now());
  }
  async refund(name: string): Promise<number | null> {
    const slot = await this.get(name);
    return this.value.refundSlot({ chainId: slot.chainId, slotId: slot.slotId });
  }

  async list(): Promise<PlaytestSlot[]> {
    const { results } = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? ORDER BY closes_at,name`)
      .bind(await this.launches.targetChain())
      .all<SlotRow>();
    const now = Date.now();
    return results.map((row) => toSlot(row, now));
  }
}
const toSlot = (row: SlotRow, now: number): PlaytestSlot => ({
  chainId: row.chain_id,
  slotId: row.slot_id,
  name: row.name,
  closesAt: new Date(row.closes_at).toISOString(),
  closed: row.closes_at <= now,
});
