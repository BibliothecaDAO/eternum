import { launchFailure } from "./errors";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "@realms-world/value-ledger";
import { SlotCancelled, type BlitzValuePort, type SlotResolver } from "./paid-blitz";
import { nativePresetIdFor } from "../../../config/source/native";
import type { D1LaunchStore } from "./store";
import {
  blitzSlotWindow,
  SlotConflict,
  SlotNotFound,
  type PlaytestSlot,
  type SlotStore,
  type SlotFreezeFailure,
} from "./slots";

const SELECT_SLOTS = "SELECT * FROM playtest_slots";
/** How long a slot whose freeze failed waits before the registrar tries it again. */
export const FREEZE_RETRY_MS = 30_000;

interface SlotRow {
  chain_id: string;
  slot_id: number;
  name: string;
  closes_at: number;
  frozen_at: number | null;
}

/** D1 stores scheduling metadata only; paid player ownership never lives in this database. */
export class D1SlotStore implements SlotStore {
  constructor(
    private readonly db: D1Database,
    private readonly launches: D1LaunchStore,
    private readonly value: BlitzValuePort,
    private readonly resolveSlot: SlotResolver,
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
        `INSERT INTO playtest_slots (name,closes_at,chain_id) SELECT ?1,?2,?3 WHERE ?2 > ?4 ON CONFLICT (chain_id,name) DO NOTHING`,
      )
      .bind(name, closes, await this.launches.targetChain(), Date.now())
      .run();
    const slot = await this.rawSlot(name).catch((error: unknown) => {
      if (error instanceof SlotNotFound) throw new SlotConflict("Registration deadline has passed");
      throw error;
    });
    if (Date.parse(slot.closesAt) !== closes) throw new SlotConflict("Slot schedule is immutable");
    const key = { chainId: slot.chainId, slotId: slot.slotId };
    try {
      await this.value.openSlot(key, blitzSlotWindow(slot.closesAt));
    } catch (error) {
      // A lost receipt or unavailable read must preserve the key for recovery.
      const recorded = await this.value.slot(key).catch(() => {
        throw error;
      });
      if (!recorded.exists)
        await this.db
          .prepare("DELETE FROM playtest_slots WHERE chain_id=? AND slot_id=?")
          .bind(slot.chainId, slot.slotId)
          .run();
      throw error;
    }
  }

  private async rawSlot(name: string) {
    const row = await this.db
      .prepare(`${SELECT_SLOTS} WHERE chain_id=? AND name=?`)
      .bind(await this.launches.targetChain(), name)
      .first<SlotRow>();
    if (!row) throw new SlotNotFound("Slot not found");
    return toSlot(row, Date.now());
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
    const now = Date.now();
    return results.map((row) => toSlot(row, now));
  }
  async freeze(name: string): Promise<PlaytestSlot> {
    const slot = await this.rawSlot(name);
    if (slot.frozenAt) return slot;
    if (!slot.closed) throw new SlotConflict("Registration is still open");
    const key = { chainId: slot.chainId, slotId: slot.slotId };
    const closed = await this.resolveSlot(key).catch((error: unknown) => {
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
          gameStartTime: new Date(Date.parse(slot.closesAt) + BLITZ_SLOT_PREPARATION_SECONDS * 1000).toISOString(),
          durationSeconds: closed!.slot.end - closed!.slot.close - BLITZ_SLOT_PREPARATION_SECONDS,
          slotId: slot.slotId,
          groupIndex,
        }),
      ),
    );
    await this.db.batch([
      ...jobs,
      this.db
        .prepare(
          "UPDATE playtest_slots SET frozen_at=?, freeze_failure=NULL WHERE chain_id=? AND slot_id=? AND frozen_at IS NULL",
        )
        .bind(Date.now(), key.chainId, key.slotId),
    ]);
    return this.get(name);
  }

  async freezeFailures(): Promise<SlotFreezeFailure[]> {
    const { results } = await this.db
      .prepare(
        "SELECT chain_id,slot_id,name,freeze_failure FROM playtest_slots WHERE chain_id=? AND frozen_at IS NULL AND freeze_failure IS NOT NULL",
      )
      .bind(await this.launches.targetChain())
      .all<SlotRow & { freeze_failure: string }>();
    return results.map((row) => ({
      chainId: row.chain_id,
      slotId: row.slot_id,
      name: row.name,
      ...(JSON.parse(row.freeze_failure) as Pick<SlotFreezeFailure, "code" | "checkedAt" | "secondsUntilClose">),
    }));
  }

  private async recordFreezeFailure(chainId: string, name: string, error: unknown): Promise<void> {
    const diagnostic = launchFailure(error);
    console.error("slot_close_unavailable", { chainId, name, ...diagnostic });
    const failure = {
      code: diagnostic.code,
      checkedAt: Date.now(),
      secondsUntilClose: diagnostic.secondsUntilClose,
    };
    await this.db
      .prepare("UPDATE playtest_slots SET freeze_failure=? WHERE chain_id=? AND name=? AND frozen_at IS NULL")
      .bind(JSON.stringify(failure), chainId, name)
      .run();
  }

  /**
   * When the registrar must next try to freeze: the earliest unfrozen slot's close, or, for one whose last freeze
   * failed, a retry after that failure. A slot already due, such as one that closed while another was freezing, is due
   * now; every unfrozen slot counts, so no unfinished freeze is left to the cron.
   */
  async nextFreeze(): Promise<number | null> {
    const row = await this.db
      .prepare(
        `SELECT MIN(MAX(closes_at, COALESCE(json_extract(freeze_failure, '$.checkedAt') + ?, 0))) AS due
         FROM playtest_slots WHERE chain_id=? AND frozen_at IS NULL`,
      )
      .bind(FREEZE_RETRY_MS, await this.launches.targetChain())
      .first<{ due: number | null }>();
    return row?.due ?? null;
  }

  async freezeDueSlots(): Promise<void> {
    const chainId = await this.launches.targetChain();
    const due = await this.db
      .prepare(
        `SELECT name FROM playtest_slots WHERE chain_id=? AND frozen_at IS NULL AND closes_at <= ? ORDER BY closes_at, name`,
      )
      .bind(chainId, Date.now())
      .all<{ name: string }>();
    for (const slot of due.results) {
      try {
        await this.freeze(slot.name);
      } catch (error) {
        await this.recordFreezeFailure(chainId, slot.name, error);
      }
    }
  }
}
const toSlot = (row: SlotRow, now: number): PlaytestSlot => ({
  chainId: row.chain_id,
  slotId: row.slot_id,
  name: row.name,
  closesAt: new Date(row.closes_at).toISOString(),
  frozenAt: row.frozen_at === null ? null : new Date(row.frozen_at).toISOString(),
  closed: row.closes_at <= now,
});
