import { dayOf, type SeasonCalendar } from "../../../packages/core/src/utils/days";

/**
 * Who gets the Devcon Season 0 comeback email, and the send itself: the parts of scripts/comeback-email.ts that decide
 * and that must be safe to run twice, kept apart from its reads and its Resend calls so they can be tested.
 */

export type VariantKey = "D" | "N" | "P";

export interface Account {
  realmsId: string;
  discord: boolean;
  ticket: "regular" | "golden" | null;
  playtester: boolean;
  inSeason: boolean;
  /** The account's latest Season 0 action, in seconds; 0 for none. */
  lastAction: number;
  /** The account followed a news email's stop link. */
  optedOut: boolean;
}

/**
 * Each account in at most one variant, D before N before P; none for an account that stopped news emails:
 * - D: holds a Devcon ticket, founded in Season 0, no action since `activeSince` (24 hours before the send).
 * - N: holds a Devcon ticket, never founded.
 * - P: owns an address on the playtest's final board, holds no ticket, no Season 0 action since `activeSince`.
 */
export function variantOf(account: Account, activeSince: number): VariantKey | null {
  if (account.optedOut) return null;
  if (account.ticket && account.inSeason) return account.lastAction < activeSince ? "D" : null;
  if (account.ticket) return account.lastAction < activeSince ? "N" : null;
  if (account.playtester && account.lastAction < activeSince) return "P";
  return null;
}

/** One confirmed event as Herald's history serves it (newest first). */
export interface HistoryEvent {
  model: string;
  block_number: number | string;
  value: Record<string, unknown>;
}

/** One daily claim as the snapshot's LaborGrant rows hold it: a home's claim on a Frontier day, by its account. */
export interface LaborGrant {
  account: string;
  day: string | number;
}

/**
 * The player each confirmed history kind names as the one who acted. A kind missing here stops the run, so an action
 * the reader cannot attribute never passes for an absence.
 */
const ACTOR_OF: Record<string, (value: Record<string, unknown>) => unknown> = {
  StoryEvent: (value) => value.owner,
  // attacker_owner is the attacking army's structure id; the player is the attacker's own field.
  BattleEvent: (value) => (value.attacker as { player?: unknown } | undefined)?.player,
  GameplayRejected: (value) => value.actor,
  BatchProgress: (value) => value.actor,
};

const address = (value: unknown) => `0x${BigInt(String(value)).toString(16)}`;

/**
 * Each player address's latest confirmed action, in seconds, from Herald's history and the season's daily claims.
 * Every time is the latest the action can have happened, so a player who may have come back counts as back:
 * - an event with a timestamp: that timestamp;
 * - an event without one (a rejected command, a batch step): the earliest timestamp of any later block, else now;
 * - a claim: the end of its Frontier day, else now.
 * Research writes no event and no time anywhere confirmed, so a player whose only action was research is not seen.
 */
export class Activity {
  private readonly latest = new Map<string, number>();
  /** Blocks with a known timestamp, as [block, seconds], kept in block order. */
  private readonly blockTimes: [number, number][] = [];
  /** The newest block whose history this holds. */
  heldBlock = 0;

  constructor(
    private readonly calendar: SeasonCalendar,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  /** Folds history events newer than the held block; older ones are already in. */
  noteHistory(events: readonly HistoryEvent[]) {
    const fresh = events.filter((event) => Number(event.block_number) > this.heldBlock);
    for (const event of fresh)
      if (event.value.timestamp != null)
        this.blockTimes.push([Number(event.block_number), Number(BigInt(String(event.value.timestamp)))]);
    this.blockTimes.sort((a, b) => a[0] - b[0]);
    for (const event of fresh) {
      const actorOf = ACTOR_OF[event.model];
      if (!actorOf) throw new Error(`unattributed history kind: ${event.model}`);
      const actor = actorOf(event.value);
      if (actor == null) throw new Error(`a ${event.model} event without its actor`);
      const at =
        event.value.timestamp != null
          ? Number(BigInt(String(event.value.timestamp)))
          : this.latestTimeOf(Number(event.block_number));
      this.note(address(actor), at);
      this.heldBlock = Math.max(this.heldBlock, Number(event.block_number));
    }
  }

  /** Folds the season's daily claims, each at the end of its Frontier day. */
  noteClaims(grants: readonly LaborGrant[]) {
    for (const grant of grants) this.note(address(grant.account), this.dayEnd(Number(BigInt(String(grant.day)))));
  }

  /** An account's latest confirmed action over the addresses it owns; 0 for none. */
  latestOf(addresses: readonly string[]) {
    return Math.max(0, ...addresses.map((owned) => this.latest.get(address(owned)) ?? 0));
  }

  private note(owner: string, at: number) {
    this.latest.set(owner, Math.max(this.latest.get(owner) ?? 0, at));
  }

  /** The earliest known timestamp at or after a block: no block after it can be older. */
  private latestTimeOf(block: number) {
    const later = this.blockTimes.find(([known]) => known >= block);
    return later ? later[1] : this.now();
  }

  private dayEnd(index: number) {
    for (let at = this.calendar.startMainAt; at < this.calendar.endAt; ) {
      const day = dayOf(this.calendar, at);
      if (!day) break;
      if (day.index === index) return Math.min(day.end, this.now());
      at = day.end;
    }
    return this.now();
  }
}

export interface Delivery {
  realmsId: string;
  variant: VariantKey;
}

/** What a reservation found: this run holds the account now, another run or attempt holds it, or it stopped news. */
export type Reservation = "reserved" | "taken" | "opted_out";

/** What the provider said: accepted, refused outright (nothing was sent), or no clear answer (it may have been sent). */
export type Handoff = { kind: "accepted"; id: string | null } | { kind: "refused" } | { kind: "unknown" };

export interface CampaignSend<T extends Delivery> {
  deliveries: readonly T[];
  /** Whether the player is still away, from the latest confirmed activity: one who acted since the run began is not. */
  stillAway: (delivery: T) => Promise<boolean>;
  /**
   * Writes the account into the campaign's send record, in one statement that also checks it has not stopped news
   * emails: before the provider hears of it, so no interrupted or parallel run can send it again.
   */
  reserve: (delivery: T) => Promise<Reservation>;
  /** Hands one email to the provider. */
  send: (delivery: T) => Promise<Handoff>;
  /** Marks the reservation sent, with the provider's receipt. */
  markSent: (delivery: T, id: string | null) => Promise<void>;
  /** Frees the reservation after an outright refusal, so a later run may try again. */
  release: (delivery: T) => Promise<void>;
  /** Waits between emails, so sign-in codes keep the provider's rate. */
  pause: () => Promise<void>;
}

/**
 * Sends each delivery whose reservation this run wins, and stops at the first refusal or unclear answer. An account
 * reserved by an earlier run that never marked it (a crash, or an unclear answer) is never sent again: it stays in the
 * record as an unresolved attempt for a person to check against the provider's log.
 */
export async function sendCampaign<T extends Delivery>(run: CampaignSend<T>) {
  const counts = { sent: 0, cameBack: 0, alreadyReserved: 0, optedOut: 0, refused: 0, unknown: 0 };
  for (const delivery of run.deliveries) {
    if (!(await run.stillAway(delivery))) {
      counts.cameBack++;
      continue;
    }
    const reservation = await run.reserve(delivery);
    if (reservation === "taken") {
      counts.alreadyReserved++;
      continue;
    }
    if (reservation === "opted_out") {
      counts.optedOut++;
      continue;
    }
    const handoff = await run.send(delivery);
    if (handoff.kind === "refused") {
      await run.release(delivery);
      counts.refused++;
      break;
    }
    if (handoff.kind === "unknown") {
      counts.unknown++;
      break;
    }
    await run.markSent(delivery, handoff.id);
    counts.sent++;
    await run.pause();
  }
  return counts;
}

/**
 * The send record's three statements (migration 0025, news_email_sends), as D1 runs them. The reservation inserts the
 * row only for an account that has not stopped news emails and that no run holds yet, and returns it when it did.
 */
export const sendRecord = {
  reserve: (campaign: string, delivery: Delivery, now: number) =>
    `INSERT INTO news_email_sends (campaign, realmsId, variant, status, reserved_at) SELECT '${campaign}', realmsId, '${delivery.variant}', 'reserved', ${now} FROM "user" WHERE realmsId = '${checkedId(delivery.realmsId)}' AND newsEmailOptOutAt IS NULL ON CONFLICT DO NOTHING RETURNING realmsId`,
  markSent: (campaign: string, delivery: Delivery, id: string | null, now: number) =>
    `UPDATE news_email_sends SET status = 'sent', resend_id = ${id !== null && /^[0-9a-f-]+$/i.test(id) ? `'${id}'` : "NULL"}, sent_at = ${now} WHERE campaign = '${campaign}' AND realmsId = '${checkedId(delivery.realmsId)}'`,
  release: (campaign: string, delivery: Delivery) =>
    `DELETE FROM news_email_sends WHERE campaign = '${campaign}' AND realmsId = '${checkedId(delivery.realmsId)}' AND status = 'reserved'`,
  optedOut: (delivery: Delivery) =>
    `SELECT newsEmailOptOutAt FROM "user" WHERE realmsId = '${checkedId(delivery.realmsId)}'`,
};

/** Only an account id goes into a statement: anything else is refused before it reaches D1. */
const checkedId = (realmsId: string) => {
  if (!/^0x[0-9a-f]+$/.test(realmsId)) throw new Error("refused: unexpected account id");
  return realmsId;
};

/**
 * A failed wrangler call as it may be logged: only the D1 error it names (a missing table or column, an SQLite or D1
 * code), never the rest, since wrangler can echo the query and the query can carry an account or an address.
 */
export function wranglerFailure(status: number | null, output: string): string {
  const named = output.match(/no such (?:table|column): [A-Za-z_][\w.]*|\bSQLITE_[A-Z_]+\b|\bD1_[A-Z_]+\b/);
  return `wrangler exit ${status}${named ? `: ${named[0]}` : ""}`;
}
