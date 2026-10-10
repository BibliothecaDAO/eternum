import { nativePresetIdFor } from "../../../config/source/native";
import type { D1LaunchStore } from "./store";
import { SlotConflict, SlotNotFound, type PlaytestSlot, type SlotStore } from "./slots";

const DATABASE_NOW = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";
const SELECT_SLOTS = `SELECT *, ${DATABASE_NOW} AS observed_at FROM playtest_slots`;

interface SlotRow {
  name: string;
  closes_at: number;
  frozen_at: number | null;
  observed_at: number;
}

/** D1 stores scheduling metadata only; paid player ownership never lives in this database. */
export class D1SlotStore implements SlotStore {
  constructor(
    private readonly db: D1Database,
    private readonly launches: D1LaunchStore,
  ) {}

  async create(name: string, closesAt: string): Promise<void> {
    if (
      (await this.launches.find("game", "madara.blitz", `${name}-1`)) &&
      !(await this.db
        .prepare("SELECT name FROM playtest_slots WHERE name = ? AND chain_id=?")
        .bind(name, await this.launches.targetChain())
        .first())
    ) {
      throw new SlotConflict("Slot name was already used for a launch");
    }
    const closes = Date.parse(closesAt);
    await this.db
      .prepare(
        `INSERT INTO playtest_slots (name, closes_at,chain_id) SELECT ?1, ?2,?3 WHERE ?2 > ${DATABASE_NOW} ON CONFLICT (chain_id,name) DO NOTHING`,
      )
      .bind(name, closes, await this.launches.targetChain())
      .run();
    const slot = await this.rawSlot(name).catch((error: unknown) => {
      if (error instanceof SlotNotFound) throw new SlotConflict("Registration deadline has passed");
      throw error;
    });
    if (Date.parse(slot.closesAt) !== closes) throw new SlotConflict("Slot schedule is immutable");
    await this.db.batch([
      await this.launches.scheduleStatement("game", {
        environment: "madara.blitz",
        version: String(nativePresetIdFor("blitz")),
        gameName: `${name}-1`,
        gameStartTime: closesAt,
        devModeOn: false,
        singleRealmMode: false,
      }),
    ]);
  }

  private async rawSlot(name: string) {
    const row = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? AND name=?`)
      .bind(await this.launches.targetChain(), name)
      .first<SlotRow>();
    if (!row) throw new SlotNotFound("Slot not found");
    return toSlot(row);
  }
  async get(name: string): Promise<PlaytestSlot> {
    const slot = await this.rawSlot(name);
    return { ...slot, entry: await this.launches.entryForSlot(name) };
  }

  async list(): Promise<PlaytestSlot[]> {
    const { results } = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? ORDER BY closes_at,name`)
      .bind(await this.launches.targetChain())
      .all<SlotRow>();
    const visible: PlaytestSlot[] = [];
    for (const row of results) {
      try {
        visible.push({ ...toSlot(row), entry: await this.launches.entryForSlot(row.name) });
      } catch (error) {
        if (error instanceof Error && error.message === "slot_entry_opening") continue;
        throw error;
      }
    }
    return visible;
  }
  async freeze(name: string): Promise<PlaytestSlot> {
    const slot = await this.rawSlot(name);
    if (slot.frozenAt) return this.get(name);
    if (!slot.closed) throw new SlotConflict("Registration is still open");
    await this.db.batch([
      this.db
        .prepare("UPDATE playtest_slots SET frozen_at = ? WHERE name = ? AND chain_id=? AND frozen_at IS NULL")
        .bind(Date.now(), name, await this.launches.targetChain()),
      // A frozen slot stays listed until the next one freezes, long enough for its games to exist and its members to
      // find them.
      this.db
        .prepare("DELETE FROM playtest_slots WHERE frozen_at IS NOT NULL AND name <> ? AND chain_id=?")
        .bind(name, await this.launches.targetChain()),
    ]);
    return this.get(name);
  }

  async freezeNextDue(): Promise<void> {
    const due = await this.db
      .prepare(
        `SELECT name FROM playtest_slots WHERE chain_id=? AND frozen_at IS NULL AND closes_at <= ${DATABASE_NOW} ORDER BY closes_at, name LIMIT 1`,
      )
      .bind(await this.launches.targetChain())
      .first<{ name: string }>();
    if (due) await this.freeze(due.name);
  }
}
const toSlot = (row: SlotRow): Omit<PlaytestSlot, "entry"> => ({
  name: row.name,
  closesAt: new Date(row.closes_at).toISOString(),
  frozenAt: row.frozen_at === null ? null : new Date(row.frozen_at).toISOString(),
  closed: row.closes_at <= row.observed_at,
});
