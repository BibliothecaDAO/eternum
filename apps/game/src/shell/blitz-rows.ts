import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";
import { canEnterGame, isGameOver, isMember } from "@/runtime/world/directory";

import { BLITZ_SEATS, registrationFor, seatsFilling } from "./blitz-slot";
import type { DirectoryGame } from "./herald";

/** A row's one action: play the game, watch it, join its slot, or a check for a seat already taken. */
export type BlitzAction = "enter" | "spectate" | "join" | "registered";

/**
 * One Blitz on the lobby's Blitz card (design o4): live, or the seconds until it starts or its slot closes, its seats,
 * and one action. A game comes from the directory; a slot still taking players comes from the launch service, and
 * its game joins the directory only once the slot closes, so the two never show the same game.
 */
export type BlitzRow = {
  key: string;
  secondsLeft: number | null;
  seats: { filled: number; total: number };
  action: BlitzAction;
} & ({ kind: "game"; game: DirectoryGame } | { kind: "slot"; slot: PlaytestSlot });

/** Live games first, then games about to start, then the slots still filling, each soonest first. */
export const blitzRows = (
  games: readonly DirectoryGame[],
  slots: readonly PlaytestSlot[],
  realmsId: string | undefined,
  now: number,
): BlitzRow[] => {
  const running = games.filter((game) => game.mode === "blitz" && !isGameOver(game));
  const live = running.filter((game) => game.status === "Live");
  const starting = running
    .filter((game) => game.status !== "Live")
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at);
  const filling = slots
    .filter((slot) => isFilling(slot) || awaitsItsGame(slot, realmsId))
    .toSorted((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
  return [
    ...live.map((game) => gameRow(game, null)),
    ...starting.map((game) => gameRow(game, game.clock.start_main_at - now)),
    ...filling.map((slot) => slotRow(slot, realmsId, now)),
  ];
};

/** The row a card with room for one shows: the player's own game to enter, else the next slot to join. */
export const leadBlitzRow = (rows: readonly BlitzRow[]): BlitzRow | undefined =>
  rows.find((row) => row.action === "enter") ?? rows.find((row) => row.kind === "slot");

const gameRow = (game: DirectoryGame, secondsLeft: number | null): BlitzRow => ({
  kind: "game",
  key: `game:${game.chainId}:${game.game_id}`,
  game,
  secondsLeft: secondsLeft === null ? null : Math.max(0, secondsLeft),
  seats: { filled: game.player_count, total: game.roster_count || BLITZ_SEATS },
  action: canEnterGame(game) ? "enter" : isMember(game) ? "registered" : "spectate",
});

const slotRow = (slot: PlaytestSlot, realmsId: string | undefined, now: number): BlitzRow => ({
  kind: "slot",
  key: `slot:${slot.name}`,
  slot,
  secondsLeft: Math.max(0, Math.floor(Date.parse(slot.closesAt) / 1000) - now),
  seats: { filled: seatsFilling(slot), total: BLITZ_SEATS },
  action: registrationFor(slot, realmsId) ? "registered" : "join",
});

const isFilling = (slot: PlaytestSlot): boolean => !slot.closed && !slot.frozenAt;

/** A slot that closed with the player on it, before their game is assigned: their check stays until the game lists. */
const awaitsItsGame = (slot: PlaytestSlot, realmsId: string | undefined): boolean =>
  registrationFor(slot, realmsId)?.gameNumber === null;
