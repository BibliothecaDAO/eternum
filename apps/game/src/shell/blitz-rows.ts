import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";
import { canEnterGame, isGameOver, isMember } from "@/runtime/world/directory";

import { BLITZ_SEATS } from "./blitz-slot";
import type { DirectoryGame } from "./herald";

/** A row's one action: play the game, watch it,  or a check for a seat already taken. */
export type BlitzAction = "enter" | "spectate" | "registered";

/**
 * One Blitz on the lobby's Blitz card (design o4): live, or the seconds until it starts or its slot closes, its opening time,
 * and any available game action. A game comes from the directory; a slot still taking players comes from the launch service, and
 * its game joins the directory only once the slot closes, so the two never show the same game.
 */
export type BlitzRow = {
  key: string;
  secondsLeft: number | null;
  seats: { filled: number; total: number } | null;
  action: BlitzAction | null;
} & ({ kind: "game"; game: DirectoryGame } | { kind: "slot"; slot: PlaytestSlot });

/** Live games first, then games about to start, then the slots still filling, each soonest first. */
export const blitzRows = (games: readonly DirectoryGame[], slots: readonly PlaytestSlot[], now: number): BlitzRow[] => {
  const running = games.filter((game) => game.mode === "blitz" && game.status !== "Settled");
  const live = running.filter((game) => game.status === "Live");
  const starting = running
    .filter((game) => game.status !== "Live")
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at);
  const filling = slots.filter(isFilling).toSorted((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
  return [
    ...live.map((game) => gameRow(game, null)),
    ...starting.map((game) => gameRow(game, isGameOver(game) ? null : game.clock.start_main_at - now)),
    ...filling.map((slot) => slotRow(slot, now)),
  ];
};

/** The row a card with room for one shows: the player's own game to enter, else the next slot. */
export const leadBlitzRow = (rows: readonly BlitzRow[]): BlitzRow | undefined =>
  rows.find((row) => row.action === "enter") ?? rows.find((row) => row.kind === "slot") ?? rows[0];

const gameRow = (game: DirectoryGame, secondsLeft: number | null): BlitzRow => ({
  kind: "game",
  key: `game:${game.chainId}:${game.game_id}`,
  game,
  secondsLeft: secondsLeft === null ? null : Math.max(0, secondsLeft),
  seats: { filled: game.player_count, total: game.roster_count || BLITZ_SEATS },
  action: gameAction(game),
});

const gameAction = (game: DirectoryGame): BlitzAction | null => {
  if (game.error) return null;
  if (isGameOver(game)) return "spectate";
  if (canEnterGame(game)) return "enter";
  return isMember(game) ? "registered" : "spectate";
};

const slotRow = (slot: PlaytestSlot, now: number): BlitzRow => ({
  kind: "slot",
  key: `slot:${slot.name}`,
  slot,
  secondsLeft: Math.max(0, Math.floor(Date.parse(slot.closesAt) / 1000) - now),
  seats: null,
  action: null,
});

const isFilling = (slot: PlaytestSlot): boolean => !slot.closed && !slot.frozenAt;
