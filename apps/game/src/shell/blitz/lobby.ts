import { formatClockTime } from "@/ui/design-system/kit/time";

import type { BlitzRow } from "../blitz-rows";
import { isSameStarknetAddress } from "@realms-world/identity";
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
  | { kind: "open" }
  | { kind: "preparing" }
  | { kind: "enter" }
  | { kind: "watch" }
  | { kind: "full"; next: BlitzRow | undefined };

/**
 * The seats a lobby draws. A slot's are its registrations on the ledger, unnamed; a launched game's are Herald's fixed
 * roster, each ticked once its player's realm is ready. A Herald that does not serve the roster leaves the taken seats
 * unnamed: as many as the game counts, each drawn as a dash.
 */
export const seatsOf = (
  row: BlitzRow,
  player: string | null,
  /** The row's taken seats (useRowSeats): for a slot the ledger's count, undefined until it answers. */
  filled: number | undefined,
): Seat[] => {
  if (row.kind === "slot" || !row.game.roster) return Array.from({ length: filled ?? 0 }, () => UNNAMED_SEAT);
  return row.game.roster.map(({ account, prepared }) => ({
    account,
    own: player !== null && isSameStarknetAddress(account, player),
    prepared,
  }));
};

const UNNAMED_SEAT: Seat = { account: null, own: false, prepared: undefined };

/**
 * The lobby's one step (spec 06): Open a slot's lobby, where its entry is paid; Preparing while the roster's realms are
 * set up, Enter once the player's is open; Watch a live game they are not on; and for a game whose seats are all taken,
 * Full with the next slot.
 */
export const lobbyStep = (row: BlitzRow, rows: readonly BlitzRow[]): LobbyStep => {
  if (row.kind === "slot" || row.action === "open") return { kind: "open" };
  if (row.action === "enter") return { kind: "enter" };
  if (row.action === "registered") return { kind: "preparing" };
  if (row.startsAt === null) return { kind: "watch" };
  return { kind: "full", next: rows.find((other) => other.kind === "slot") };
};
