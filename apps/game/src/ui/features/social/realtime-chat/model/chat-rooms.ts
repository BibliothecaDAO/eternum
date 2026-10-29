import type { GameModeId } from "@/config/game-modes";
import { BLITZ_WORDS } from "@/ui/design-system/kit/words";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { normalizeStarknetAddress } from "@realms-world/identity";

/** A room the chat shows as a tab beside Messages: its zone on the chat server and its tab's word. */
export interface ChatRoom {
  zoneId: string;
  label: string;
}

export const GLOBAL_ROOM: ChatRoom = { zoneId: GLOBAL_CHAT_CHANNEL_ID, label: "Global" };

/**
 * The modes whose games show their own room beside Global. None for now (owner, 28 October 2026: "we can cut the per
 * game rooms indeed I think for now, we might bring them back for blitz though or only show them in blitz"): adding
 * "blitz" here shows a Blitz game's room as a Game tab, and joins it, in Blitz only.
 */
const GAME_ROOM_MODES: readonly GameModeId[] = [];

/** The rooms a player has where they stand: Global everywhere, and a game's own room where its mode keeps one. */
export const chatRooms = (game: { zoneId: string; mode: GameModeId } | null): ChatRoom[] => [
  GLOBAL_ROOM,
  ...(game && GAME_ROOM_MODES.includes(game.mode) ? [{ zoneId: game.zoneId, label: "Game" }] : []),
];

/**
 * A Blitz lobby's room, first on its page, before Global: the slot's own (`slot:<shard>:<name>`, two shards may each
 * open a slot of one name). Any signed-in player reads it; a player registered in the slot writes.
 */
export const lobbyRoom = (slot: { chainId: string; name: string }): ChatRoom => ({
  zoneId: `slot:${normalizeStarknetAddress(slot.chainId)}:${slot.name}`,
  label: BLITZ_WORDS.lobby,
});
