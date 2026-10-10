import { formatClockTime } from "@/ui/design-system/kit/time";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { type BlitzRow, slotRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { isSameStarknetAddress } from "@realms-world/identity";
import { ageOf } from "../play/ages";

/** A lobby's title is its game's start time: "Blitz 16:30". */
export const lobbyTitle = (row: BlitzRow) =>
  `${ageOf("blitz").name} ${formatClockTime(row.startsAt ?? (row.kind === "game" ? row.game.clock.start_main_at : undefined))}`;

/** A Blitz row's lobby address: its row key with the colons a URL segment cannot carry plainly. */
export const lobbyId = (row: Pick<BlitzRow, "key">) => row.key.replaceAll(":", "-");

/**
 * The row a lobby address names: a listed row, or a slot past its close, whose lobby still holds its entry's outcome
 * (seated in a game, or a refund to take) though the list no longer shows it.
 */
export const lobbyRowOf = (rows: readonly BlitzRow[], slots: readonly PlaytestSlot[], id: string | undefined) =>
  rows.find((row) => lobbyId(row) === id) ?? slots.map(slotRow).find((row) => lobbyId(row) === id);

/**
 * One taken seat of a launched game: the account in it (null when the seat is known taken but Herald does not name its
 * player), whether it is the player's own, and whether that player's realm is ready (undefined while Herald does not
 * serve the roster).
 */
export type Seat = {
  account: string | null;
  /** The wallet the roster froze for the seat, whose rating it shows; null for a seat Herald does not name. */
  wallet: string | null;
  own: boolean;
  prepared: boolean | undefined;
};

/** What a lobby offers: the one action, or the fact that stands where it would. */
export type LobbyStep = { kind: "open" } | { kind: "preparing" } | { kind: "enter" } | { kind: "watch" };

/**
 * A launched game's seats: Herald's fixed roster, each ticked once its player's realm is ready. A Herald that does not
 * serve the roster leaves the taken seats unnamed: as many as the game counts, each drawn as a dash. A slot has no
 * seats: its games are drawn at close.
 */
export const seatsOf = (game: DirectoryGame, player: string | null): Seat[] => {
  if (!game.roster) return Array.from({ length: game.player_count }, () => UNNAMED_SEAT);
  return game.roster.map(({ account, wallet, prepared }) => ({
    account,
    wallet,
    own: player !== null && isSameStarknetAddress(account, player),
    prepared,
  }));
};

const UNNAMED_SEAT: Seat = { account: null, wallet: null, own: false, prepared: undefined };

/**
 * The lobby's one step (spec 06): Open a slot's lobby, where its entry is paid; Preparing while the roster's realms are
 * set up, Enter once the player's is open; Watch a game they are not on (its roster was fixed when its slot closed).
 */
export const lobbyStep = (row: BlitzRow): LobbyStep => {
  if (row.kind === "slot" || row.action === "open") return { kind: "open" };
  if (row.action === "enter") return { kind: "enter" };
  if (row.action === "registered") return { kind: "preparing" };
  return { kind: "watch" };
};
