import type { RegistrationIdentity } from "@realms-world/value-ledger";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { closedSlotGroups, SlotCancelled, type BlitzValuePort } from "./paid-blitz";
import { nativePresetIdFor } from "../../../config/source/native";
import type { D1LaunchStore } from "./store";
import { SlotConflict, SlotNotFound, type PlaytestSlot, type SlotStore } from "./slots";

const DATABASE_NOW = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";
const SELECT_SLOTS = `SELECT *, ${DATABASE_NOW} AS observed_at FROM playtest_slots`;

interface SlotRow {
  chain_id: string;
  slot_id: number;
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
    private readonly value: BlitzValuePort,
    private readonly identity: RegistrationIdentity,
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
    if (!Number.isSafeInteger(closes) || closes % 1000 !== 0)
      throw new SlotConflict("Slot close must be a whole second");
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
    const duration = loadNativePresetConfiguration("madara.blitz", nativePresetIdFor("blitz")).season.durationSeconds;
    await this.value.openSlot(
      { chainId: slot.chainId, slotId: slot.slotId },
      { start: closes / 1000, end: closes / 1000 + duration },
    );
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
    return this.rawSlot(name);
  }

  async refund(name: string): Promise<number | null> {
    const slot = await this.rawSlot(name);
    return this.value.refundSlot({ chainId: slot.chainId, slotId: slot.slotId });
  }

  async list(): Promise<PlaytestSlot[]> {
    const { results } = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? ORDER BY closes_at,name`)
      .bind(await this.launches.targetChain())
      .all<SlotRow>();
    return results.map(toSlot);
  }
  async freeze(name: string): Promise<PlaytestSlot> {
    const slot = await this.rawSlot(name);
    if (slot.frozenAt) return slot;
    if (!slot.closed) throw new SlotConflict("Registration is still open");
    const key = { chainId: slot.chainId, slotId: slot.slotId };
    const closed = await closedSlotGroups(key, this.value, this.identity).catch((error: unknown) => {
      if (error instanceof SlotCancelled) return null;
      throw error;
    });
    // Mark once at close, after every historical identity has resolved. Game retries only read the cohort.
    for (let offset = 0; closed && offset < closed.refunds.length; offset += 100)
      await this.value.markRefundable(key, closed.refunds.slice(offset, offset + 100));
    const jobs = await Promise.all(
      (closed?.groups ?? []).map((_, groupIndex) =>
        this.launches.scheduleStatement("game", {
          environment: "madara.blitz",
          version: String(nativePresetIdFor("blitz")),
          gameName: `${name}-${groupIndex + 1}`,
          gameStartTime: slot.closesAt,
          durationSeconds: closed!.slot.end - closed!.slot.close,
          slotId: slot.slotId,
          groupIndex,
        }),
      ),
    );
    await this.db.batch([
      ...jobs,
      this.db
        .prepare("UPDATE playtest_slots SET frozen_at=? WHERE chain_id=? AND slot_id=? AND frozen_at IS NULL")
        .bind(Date.now(), key.chainId, key.slotId),
    ]);
    return this.get(name);
  }

  async freezeDueSlots(): Promise<void> {
    const due = await this.db
      .prepare(
        `SELECT name FROM playtest_slots WHERE chain_id=? AND frozen_at IS NULL AND closes_at <= ${DATABASE_NOW} ORDER BY closes_at, name`,
      )
      .bind(await this.launches.targetChain())
      .all<{ name: string }>();
    for (const slot of due.results) {
      try {
        await this.freeze(slot.name);
      } catch {
        console.error("slot_close_unavailable", { name: slot.name });
      }
    }
  }
}
const toSlot = (row: SlotRow): PlaytestSlot => ({
  chainId: row.chain_id,
  slotId: row.slot_id,
  name: row.name,
  closesAt: new Date(row.closes_at).toISOString(),
  frozenAt: row.frozen_at === null ? null : new Date(row.frozen_at).toISOString(),
  closed: row.closes_at <= row.observed_at,
});
