import { formatClockTime } from "@/ui/design-system/kit/time";
import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import { BLITZ_SEATS, registrationFor } from "../blitz-slot";
import { ageOf } from "../play/ages";

/** A lobby's title is its game's start time: "Blitz 16:30". */
export const lobbyTitle = (row: BlitzRow) =>
  `${ageOf("blitz").name} ${formatClockTime(row.startsAt ?? (row.kind === "game" ? row.game.clock.start_main_at : undefined))}`;

/** A Blitz row's lobby address: its row key with the colons a URL segment cannot carry plainly. */
export const lobbyId = (row: Pick<BlitzRow, "key">) => row.key.replaceAll(":", "-");

/** One taken seat: the gameplay account in it, and whether it is the player's own. */
type Seat = { account: string; own: boolean };

/** What a lobby offers: the one action, or the fact that stands where it would. */
export type LobbyStep =
  | { kind: "join" }
  | { kind: "joined" }
  | { kind: "preparing"; ready: number; total: number }
  | { kind: "enter" }
  | { kind: "watch" }
  | { kind: "full"; next: BlitzRow | undefined };

/** The game a slot is filling now: registrations past a full roster start the next game's seats. */
const fillingNow = (slot: PlaytestSlot) => {
  const start = Math.floor(Math.max(0, slot.registrations.length - 1) / BLITZ_SEATS) * BLITZ_SEATS;
  return slot.registrations.slice(start);
};

/** A launched game's roster: its slot's registrations for that game's number ("<slot>-<n>"). */
const rosterOfGame = (name: string, slots: readonly PlaytestSlot[]) => {
  for (const slot of slots) {
    const number = name.startsWith(`${slot.name}-`) ? Number(name.slice(slot.name.length + 1)) : NaN;
    if (Number.isInteger(number))
      return slot.registrations.filter((registration) => registration.gameNumber === number);
  }
  return [];
};

/**
 * The seats a lobby draws, from the launch service's registrations: the slot's game filling now, or a launched
 * game's roster. Empty when the service names no roster for that game (its sockets stay empty).
 */
export const seatsOf = (row: BlitzRow, slots: readonly PlaytestSlot[], realmsId: string | undefined): Seat[] => {
  const registrations = row.kind === "slot" ? fillingNow(row.slot) : rosterOfGame(row.game.name, slots);
  return registrations.map((registration) => ({
    account: registration.account,
    own: realmsId !== undefined && registration.realmsId !== null && BigInt(registration.realmsId) === BigInt(realmsId),
  }));
};

/**
 * The lobby's one step (spec 06): Join while the player has no seat, then nothing while they wait (a seat cannot be
 * given up), Preparing while the roster's realms are set up, Enter once theirs is open; Watch a live game they are not
 * on; and for a game whose seats are all taken, Full with the next game that still has seats.
 */
export const lobbyStep = (row: BlitzRow, rows: readonly BlitzRow[], realmsId: string | undefined): LobbyStep => {
  if (row.kind === "slot") return registrationFor(row.slot, realmsId) ? { kind: "joined" } : { kind: "join" };
  if (row.action === "enter") return { kind: "enter" };
  if (row.action === "registered")
    return { kind: "preparing", ready: Math.min(row.game.player_count, row.seats.total), total: row.seats.total };
  if (row.startsAt === null) return { kind: "watch" };
  return { kind: "full", next: rows.find((other) => other.kind === "slot" && other.action === "join") };
};
