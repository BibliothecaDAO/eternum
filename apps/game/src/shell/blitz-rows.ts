import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";
import { canEnterGame, isGameOver, isMember } from "@/runtime/world/directory";

import { BLITZ_SEATS } from "./blitz-slot";
import type { DirectoryGame } from "./herald";
import type { GameKey, SlotKey } from "./value/ledger";

/** A row's one action: play the game, watch it, a check for a seat already taken, or open a slot's lobby to pay. */
export type BlitzAction = "enter" | "spectate" | "registered" | "open";

/**
 * One Blitz on the lobby's Blitz card (design o4): live, or the moment it starts or its slot closes, and one action;
 * a game has its roster's seats, a slot only the count the ledger registered (it is uncapped and splits into games at
 * close). A game comes from the directory; a slot still taking players comes from the launch service, and its games
 * join the directory only once the slot closes, so the two never show the same game.
 */
export type BlitzRow = {
  key: string;
  /** When it starts (a game) or its slot closes (a slot); null once it is live or over. */
  startsAt: number | null;
  action: BlitzAction | null;
} & (
  | { kind: "game"; game: DirectoryGame; seats: { filled: number; total: number } }
  | { kind: "slot"; slot: PlaytestSlot }
);

/** Live games first, then games about to start, then the slots still filling, each soonest first. */
export const blitzRows = (games: readonly DirectoryGame[], slots: readonly PlaytestSlot[]): BlitzRow[] => {
  const running = games.filter((game) => game.mode === "blitz" && game.status !== "Settled");
  const live = running.filter((game) => game.status === "Live");
  const starting = running
    .filter((game) => game.status !== "Live")
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at);
  const filling = slots.filter(isFilling).toSorted((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
  return [
    ...live.map((game) => gameRow(game, null)),
    ...starting.map((game) => gameRow(game, isGameOver(game) ? null : game.clock.start_main_at)),
    ...filling.map(slotRow),
  ];
};

/** A slot's key on the environment's ledger: the shard the launch service opened it on, and its number there. */
export const slotKeyOf = (slot: PlaytestSlot): SlotKey => ({ shard: slot.chainId, slotId: slot.slotId });

/** A launched game's own key on the ledger, for its result and chest. */
export const gameKeyOf = (game: DirectoryGame): GameKey => ({ shard: game.chainId, gameId: game.game_id });

/** A launched game's row key, which its lobby's address is made from. */
export const gameRowKey = (shard: string, gameId: number) => `game:${shard}:${gameId}`;

/** The slot a launched paid Blitz was filled from; null for any game outside a slot. */
export const gameSlotKeyOf = (game: DirectoryGame): SlotKey | null =>
  game.slotId == null ? null : { shard: game.chainId, slotId: game.slotId };

/** The row a card with room for one shows: the player's own game to enter, else the next slot to open. */
export const leadBlitzRow = (rows: readonly BlitzRow[]): BlitzRow | undefined =>
  rows.find((row) => row.action === "enter") ?? rows.find((row) => row.kind === "slot") ?? rows[0];

const gameRow = (game: DirectoryGame, startsAt: number | null): BlitzRow => ({
  kind: "game",
  key: gameRowKey(game.chainId, game.game_id),
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

/** A slot is paid: its lobby holds the entry, and only the ledger counts its registrations. */
export const slotRow = (slot: PlaytestSlot): BlitzRow => ({
  kind: "slot",
  key: `slot:${slot.name}`,
  slot,
  startsAt: Math.floor(Date.parse(slot.closesAt) / 1000),
  action: "open",
});

const isFilling = (slot: PlaytestSlot): boolean => !slot.closed && !slot.frozenAt;
