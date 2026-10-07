import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";
import { canEnterGame, isGameOver, isMember } from "@/runtime/world/directory";

import { BLITZ_SEATS, registrationFor, seatsFilling } from "./blitz-slot";
import type { DirectoryGame } from "./herald";

/** A row's one action: play the game, watch it, join its slot, or a check for a seat already taken. */
export type BlitzAction = "enter" | "spectate" | "join" | "registered";

/**
 * One Blitz on the lobby's Blitz card (design o4): live, or the moment it starts or its slot closes, its seats, and
 * one action. A game comes from the directory; a slot still taking players comes from the launch service, and
 * its game joins the directory only once the slot closes, so the two never show the same game.
 */
export type BlitzRow = {
  key: string;
  /** When it starts (a game) or its slot closes (a slot); null once it is live or over. */
  startsAt: number | null;
  seats: { filled: number; total: number };
  action: BlitzAction | null;
} & ({ kind: "game"; game: DirectoryGame } | { kind: "slot"; slot: PlaytestSlot });

/** Live games first, then games about to start, then the slots still filling, each soonest first. */
export const blitzRows = (
  games: readonly DirectoryGame[],
  slots: readonly PlaytestSlot[],
  realmsId: string | undefined,
): BlitzRow[] => {
  const running = games.filter((game) => game.mode === "blitz" && game.status !== "Settled");
  const live = running.filter((game) => game.status === "Live");
  const starting = running
    .filter((game) => game.status !== "Live")
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at);
  const filling = slots
    .filter((slot) => isFilling(slot) || awaitsItsGame(slot, realmsId, games))
    .toSorted((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
  return [
    ...live.map((game) => gameRow(game, null)),
    ...starting.map((game) => gameRow(game, isGameOver(game) ? null : game.clock.start_main_at)),
    ...filling.map((slot) => slotRow(slot, realmsId)),
  ];
};

/** The row a card with room for one shows: the player's own game to enter, else the next slot to join. */
export const leadBlitzRow = (rows: readonly BlitzRow[]): BlitzRow | undefined =>
  rows.find((row) => row.action === "enter") ?? rows.find((row) => row.kind === "slot") ?? rows[0];

const gameRow = (game: DirectoryGame, startsAt: number | null): BlitzRow => ({
  kind: "game",
  key: `game:${game.chainId}:${game.game_id}`,
  game,
  startsAt,
  seats: { filled: game.player_count, total: game.roster_count || BLITZ_SEATS },
  action: gameAction(game),
});

const gameAction = (game: DirectoryGame): BlitzAction | null => {
  if (game.error) return null;
  if (isGameOver(game)) return "spectate";
  if (canEnterGame(game)) return "enter";
  return isMember(game) ? "registered" : "spectate";
};

const slotRow = (slot: PlaytestSlot, realmsId: string | undefined): BlitzRow => ({
  kind: "slot",
  key: `slot:${slot.name}`,
  slot,
  startsAt: Math.floor(Date.parse(slot.closesAt) / 1000),
  seats: { filled: seatsFilling(slot), total: BLITZ_SEATS },
  action: registrationFor(slot, realmsId) ? "registered" : "join",
});

const isFilling = (slot: PlaytestSlot): boolean => !slot.closed && !slot.frozenAt;

/** Keep a registered player's slot until their assigned game actually reaches the directory. */
const awaitsItsGame = (slot: PlaytestSlot, realmsId: string | undefined, games: readonly DirectoryGame[]): boolean => {
  const registration = registrationFor(slot, realmsId);
  if (!registration) return false;
  return (
    registration.gameNumber === null || !games.some((game) => game.name === `${slot.name}-${registration.gameNumber}`)
  );
};
