import { formatClockTime } from "@/ui/design-system/kit/time";
import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import { BLITZ_SEATS, registrationFor } from "../blitz-slot";
import { sameAddress } from "../format";
import { ageOf } from "../play/ages";

/** A lobby's title is its game's start time: "Blitz 16:30". */
export const lobbyTitle = (row: BlitzRow) =>
  `${ageOf("blitz").name} ${formatClockTime(row.startsAt ?? (row.kind === "game" ? row.game.clock.start_main_at : undefined))}`;

/** A Blitz row's lobby address: its row key with the colons a URL segment cannot carry plainly. */
export const lobbyId = (row: Pick<BlitzRow, "key">) => row.key.replaceAll(":", "-");

/**
 * One taken seat: the account in it (null when the seat is known taken but Herald does not name its player), whether
 * it is the player's own, and whether that player's realm is ready (undefined while unknown: a slot not launched, or
 * a Herald that does not serve the roster).
 */
export type Seat = { account: string | null; own: boolean; prepared: boolean | undefined };

/** What a lobby offers: the one action, or the fact that stands where it would. */
export type LobbyStep =
  | { kind: "join" }
  | { kind: "joined" }
  | { kind: "preparing" }
  | { kind: "enter" }
  | { kind: "watch" }
  | { kind: "full"; next: BlitzRow | undefined };

/** The game a slot is filling now: registrations past a full roster start the next game's seats. */
const fillingNow = (slot: PlaytestSlot) => {
  const start = Math.floor(Math.max(0, slot.registrations.length - 1) / BLITZ_SEATS) * BLITZ_SEATS;
  return slot.registrations.slice(start);
};

/**
 * The seats a lobby draws. A slot's are the launch service's registrations for the game it is filling now; a launched
 * game's are Herald's fixed roster, each ticked once its player's realm is ready. A Herald that does not serve the
 * roster leaves the taken seats unnamed: as many as the game counts, each drawn as a dash.
 */
export const seatsOf = (row: BlitzRow, realmsId: string | undefined, player: string | null): Seat[] => {
  if (row.kind === "slot")
    return fillingNow(row.slot).map((registration) => ({
      account: registration.account,
      own:
        realmsId !== undefined && registration.realmsId !== null && BigInt(registration.realmsId) === BigInt(realmsId),
      prepared: undefined,
    }));
  if (!row.game.roster) return Array.from({ length: row.seats.filled }, () => UNNAMED_SEAT);
  return row.game.roster.map(({ account, prepared }) => ({
    account,
    own: player !== null && sameAddress(account, player),
    prepared,
  }));
};

const UNNAMED_SEAT: Seat = { account: null, own: false, prepared: undefined };

/**
 * The lobby's one step (spec 06): Join while the player has no seat, then nothing while they wait (a seat cannot be
 * given up), Preparing while the roster's realms are set up, Enter once theirs is open; Watch a live game they are not
 * on; and for a game whose seats are all taken, Full with the next game that still has seats.
 */
export const lobbyStep = (row: BlitzRow, rows: readonly BlitzRow[], realmsId: string | undefined): LobbyStep => {
  if (row.kind === "slot") return registrationFor(row.slot, realmsId) ? { kind: "joined" } : { kind: "join" };
  if (row.action === "enter") return { kind: "enter" };
  if (row.action === "registered") return { kind: "preparing" };
  if (row.startsAt === null) return { kind: "watch" };
  return { kind: "full", next: rows.find((other) => other.kind === "slot" && other.action === "join") };
};
