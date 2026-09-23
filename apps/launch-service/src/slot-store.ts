import { nativePresetIdFor } from "../../../config/source/native";
import { normalizeAddress } from "./address";
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
  realms_id: string;
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
  constructor(private readonly db: D1Database) {}

  async create(name: string, closesAt: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO playtest_slots (name, closes_at) VALUES (?, ?) ON CONFLICT (name) DO NOTHING")
      .bind(name, Date.parse(closesAt))
      .run();
  }

  async list(): Promise<PlaytestSlot[]> {
    const [slots, registrations] = await this.db.batch<SlotRow | RegistrationRow>([
      this.db.prepare("SELECT * FROM playtest_slots ORDER BY closes_at, name"),
      this.db.prepare("SELECT * FROM playtest_registrations ORDER BY position"),
    ]);
    const rosters = rosterBySlot(registrations!.results as RegistrationRow[]);
    return (slots!.results as SlotRow[]).map((row) => toSlot(row, rosters.get(row.name) ?? [], Date.now()));
  }

  async register(name: string, player: SlotPlayer): Promise<PlaytestSlot> {
    const realmsId = normalizeAddress(player.realmsId);
    const account = normalizeAddress(player.account);
    if (BigInt(account) === 0n) throw new SlotConflict("A gameplay account is required");
    const now = Date.now();
    if (!isOpen(await this.readSlot(name), now)) throw new SlotConflict("Registration is closed");
    await this.db
      .prepare(
        `INSERT INTO playtest_registrations (slot_name, realms_id, account, position)
         SELECT ?1, ?2, ?3, COALESCE((SELECT MAX(position) FROM playtest_registrations WHERE slot_name = ?1), 0) + 1
         WHERE EXISTS (SELECT 1 FROM playtest_slots WHERE name = ?1 AND frozen_at IS NULL AND closes_at > ?4)
         ON CONFLICT (slot_name, realms_id) DO NOTHING`,
      )
      .bind(name, realmsId, account, now)
      .run();
    const slot = await this.readSlot(name);
    if (!slot.registrations.some((registration) => registration.realmsId === realmsId))
      throw new SlotConflict("Registration is closed");
    return slot;
  }

  async freeze(name: string): Promise<PlaytestSlot> {
    const slot = await this.readSlot(name);
    if (slot.frozenAt) return slot;
    if (!slot.closed) throw new SlotConflict("Registration is still open");
    const groups = splitPlaytestRoster(slot.registrations);
    await this.db.batch([
      ...groups.flatMap((group, index) => group.map(({ realmsId }) => this.assignGame(name, realmsId, index + 1))),
      ...groups.map((group, index) => this.queueSlotGame(slot, index + 1, group)),
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

  private assignGame(slotName: string, realmsId: string, gameNumber: number) {
    return this.db
      .prepare("UPDATE playtest_registrations SET game_number = ? WHERE slot_name = ? AND realms_id = ?")
      .bind(gameNumber, slotName, realmsId);
  }

  private queueSlotGame(slot: PlaytestSlot, gameNumber: number, players: readonly SlotRegistration[]) {
    const gameName = `${slot.name}-${gameNumber}`;
    const request = {
      environment: "madara.blitz",
      version: String(nativePresetIdFor("blitz")),
      gameName,
      gameStartTime: slot.closesAt,
      devModeOn: false,
      singleRealmMode: false,
      rosterAccounts: players.map(({ account }) => account),
    };
    const now = Date.now();
    return this.db
      .prepare(
        `INSERT INTO launch_runs (id, kind, environment, name, request, status, available_at, created_at, updated_at)
         VALUES (?, 'game', 'madara.blitz', ?, ?, 'queued', ?, ?, ?)
         ON CONFLICT (kind, environment, name) DO NOTHING`,
      )
      .bind(crypto.randomUUID(), gameName, JSON.stringify(request), now, now, now);
  }

  private async readSlot(name: string): Promise<PlaytestSlot> {
    const [slots, registrations] = await this.db.batch<SlotRow | RegistrationRow>([
      this.db.prepare("SELECT * FROM playtest_slots WHERE name = ?").bind(name),
      this.db.prepare("SELECT * FROM playtest_registrations WHERE slot_name = ? ORDER BY position").bind(name),
    ]);
    const row = slots!.results[0] as SlotRow | undefined;
    if (!row) throw new SlotNotFound("Playtest slot not found");
    return toSlot(row, (registrations!.results as RegistrationRow[]).map(toRegistration), Date.now());
  }
}

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
