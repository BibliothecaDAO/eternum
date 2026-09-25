import { nativePresetIdFor } from "../../../config/source/native";
import { normalizeAddress } from "./address";
import type { CreateGameRequest } from "./schemas";
import type { D1LaunchStore } from "./store";
import {
  SlotConflict,
  SlotNotFound,
  splitPlaytestRoster,
  type PlaytestSlot,
  type SlotPlayer,
  type SlotRegistration,
  type SlotStore,
} from "./slots";

interface SlotRow {
  name: string;
  closes_at: number;
  frozen_at: number | null;
}

interface RegistrationRow {
  slot_name: string;
  realms_id: string | null;
  account: string;
  position: number;
  game_number: number | null;
}

/**
 * Slots and their rosters on D1. D1 has no interactive transaction, so each mutation reads first and then writes in
 * one atomic batch whose statements are safe to repeat: registration closes at the deadline and freezing happens after
 * it, so two freezers read the same roster and write the same groups.
 */
export class D1SlotStore implements SlotStore {
  constructor(
    private readonly db: D1Database,
    private readonly launches: D1LaunchStore,
  ) {}

  async create(name: string, closesAt: string): Promise<PlaytestSlot> {
    const closes = Date.parse(closesAt);
    await this.db
      .prepare("INSERT INTO playtest_slots (name, closes_at) SELECT ?1, ?2 WHERE ?2 > ?3 ON CONFLICT (name) DO NOTHING")
      .bind(name, closes, Date.now())
      .run();
    const slot = await this.readSlot(name).catch((error: unknown) => {
      if (error instanceof SlotNotFound) throw new SlotConflict("Registration deadline has passed");
      throw error;
    });
    if (Date.parse(slot.closesAt) !== closes) throw new SlotConflict("Slot schedule is immutable");
    return slot;
  }

  async list(): Promise<PlaytestSlot[]> {
    const [slots, registrations] = await this.db.batch<SlotRow | RegistrationRow>([
      this.db.prepare("SELECT * FROM playtest_slots ORDER BY closes_at, name"),
      this.db.prepare("SELECT * FROM playtest_registrations ORDER BY position"),
    ]);
    const rosters = rosterBySlot(registrations!.results as RegistrationRow[]);
    return (slots!.results as SlotRow[]).map((row) => toSlot(row, rosters.get(row.name) ?? [], Date.now()));
  }

  async register(name: string, players: readonly SlotPlayer[]): Promise<PlaytestSlot> {
    const entries = players.map(({ realmsId, account }) => ({
      realmsId: realmsId === null ? null : normalizeAddress(realmsId),
      account: normalizeAddress(account),
    }));
    if (entries.some(({ account }) => BigInt(account) === 0n)) throw new SlotConflict("Invalid roster account");
    // One round trip: the inserts (each written only while the slot is open) and the slot as they left it.
    const now = Date.now();
    const results = await this.db.batch<SlotRow | RegistrationRow>([
      ...entries.map((entry) => this.registration(name, entry, now)),
      ...this.slotReads(name),
    ]);
    const slot = slotFrom(results.slice(-2), now);
    const registered = new Set(slot.registrations.map(({ account }) => account));
    if (!isOpen(slot, now) || !entries.every(({ account }) => registered.has(account)))
      throw new SlotConflict("Registration is closed");
    return slot;
  }

  /** One registration, written only while the slot is open, after every earlier one; a repeat changes nothing. */
  private registration(name: string, { realmsId, account }: SlotPlayer, now: number) {
    return this.db
      .prepare(
        `INSERT INTO playtest_registrations (slot_name, realms_id, account, position)
         SELECT ?1, ?2, ?3, COALESCE((SELECT MAX(position) FROM playtest_registrations WHERE slot_name = ?1), 0) + 1
         WHERE EXISTS (SELECT 1 FROM playtest_slots WHERE name = ?1 AND frozen_at IS NULL AND closes_at > ?4)
         ON CONFLICT DO NOTHING`,
      )
      .bind(name, realmsId, account, now);
  }

  async freeze(name: string): Promise<PlaytestSlot> {
    const slot = await this.readSlot(name);
    if (slot.frozenAt) return slot;
    if (!slot.closed) throw new SlotConflict("Registration is still open");
    const groups = splitPlaytestRoster(slot.registrations);
    await this.db.batch([
      ...groups.map((group, index) => this.assignGame(name, group, index + 1)),
      ...(await Promise.all(groups.map((group, index) => this.queueSlotGame(slot, index + 1, group)))),
      this.db
        .prepare("UPDATE playtest_slots SET frozen_at = ? WHERE name = ? AND frozen_at IS NULL")
        .bind(Date.now(), name),
      // A frozen slot stays listed until the next one freezes, long enough for its games to exist and its members to
      // find them.
      this.db.prepare("DELETE FROM playtest_slots WHERE frozen_at IS NOT NULL AND name <> ?").bind(name),
    ]);
    return this.readSlot(name);
  }

  async freezeNextDue(): Promise<void> {
    const due = await this.db
      .prepare(
        "SELECT name FROM playtest_slots WHERE frozen_at IS NULL AND closes_at <= ? ORDER BY closes_at, name LIMIT 1",
      )
      .bind(Date.now())
      .first<{ name: string }>();
    if (due) await this.freeze(due.name);
  }

  /** One statement numbers a whole game: its positions travel as one JSON list, whatever order grouped them. */
  private assignGame(slotName: string, group: readonly SlotRegistration[], gameNumber: number) {
    return this.db
      .prepare(
        "UPDATE playtest_registrations SET game_number = ? WHERE slot_name = ? AND position IN (SELECT value FROM json_each(?))",
      )
      .bind(gameNumber, slotName, JSON.stringify(group.map(({ position }) => position)));
  }

  private queueSlotGame(slot: PlaytestSlot, gameNumber: number, players: readonly SlotRegistration[]) {
    return this.launches.scheduleStatement("game", {
      environment: "madara.blitz",
      version: String(nativePresetIdFor("blitz")) as CreateGameRequest["version"],
      gameName: `${slot.name}-${gameNumber}`,
      gameStartTime: slot.closesAt,
      devModeOn: false,
      singleRealmMode: false,
      rosterAccounts: players.map(({ account }) => account),
    });
  }

  private async readSlot(name: string): Promise<PlaytestSlot> {
    return slotFrom(await this.db.batch<SlotRow | RegistrationRow>(this.slotReads(name)), Date.now());
  }

  private slotReads(name: string) {
    return [
      this.db.prepare("SELECT * FROM playtest_slots WHERE name = ?").bind(name),
      this.db.prepare("SELECT * FROM playtest_registrations WHERE slot_name = ? ORDER BY position").bind(name),
    ];
  }
}

/** A slot from the two reads of slotReads, in order. */
const slotFrom = (results: D1Result<SlotRow | RegistrationRow>[], now: number): PlaytestSlot => {
  const row = results[0]!.results[0] as SlotRow | undefined;
  if (!row) throw new SlotNotFound("Playtest slot not found");
  return toSlot(row, (results[1]!.results as RegistrationRow[]).map(toRegistration), now);
};

const isOpen = (slot: PlaytestSlot, now: number) => !slot.frozenAt && Date.parse(slot.closesAt) > now;

const toRegistration = (row: RegistrationRow): SlotRegistration => ({
  realmsId: row.realms_id,
  account: row.account,
  position: row.position,
  gameNumber: row.game_number,
});

const rosterBySlot = (rows: RegistrationRow[]) => {
  const rosters = new Map<string, SlotRegistration[]>();
  for (const row of rows) rosters.set(row.slot_name, [...(rosters.get(row.slot_name) ?? []), toRegistration(row)]);
  return rosters;
};

const toSlot = (row: SlotRow, registrations: SlotRegistration[], now: number): PlaytestSlot => ({
  name: row.name,
  closesAt: new Date(row.closes_at).toISOString(),
  frozenAt: row.frozen_at === null ? null : new Date(row.frozen_at).toISOString(),
  closed: row.closes_at <= now,
  registrations,
});
