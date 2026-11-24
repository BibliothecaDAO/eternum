import { BLITZ_SLOT_NAME_PATTERN, normalizeStarknetAddress } from "@realms-world/identity";
import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";
import { aspectChatRoom, aspects, GLOBAL_CHAT_CHANNEL_ID, parseAspectChatRoom } from "@bibliothecadao/types";

import { aspectOn } from "../account-aspect";
import { directoryShard } from "../directory";

export type ChatRoomId =
  | typeof GLOBAL_CHAT_CHANNEL_ID
  | `game:${string}:${number}`
  | `slot:${string}`
  | `aspect:${string}:${number}:${number}`;

export const slotRoomKey = (room: string) => {
  const match = /^slot:(0x[0-9a-f]{1,64}):([^:]+)$/.exec(room);
  return match && BigInt(match[1]!) > 0n && BLITZ_SLOT_NAME_PATTERN.test(match[2]!)
    ? { chainId: normalizeStarknetAddress(match[1]!), name: match[2]! }
    : null;
};

const GAME_ROOM = /^game:(0x[0-9a-f]{1,64}):([1-9][0-9]{0,9})$/;
const isAspectRoom = (value: string) => aspects.some(({ id }) => id === parseAspectChatRoom(value)?.aspect);

export const parseChatRoom = (value: unknown): ChatRoomId | null => {
  if (value === GLOBAL_CHAT_CHANNEL_ID) return GLOBAL_CHAT_CHANNEL_ID;
  if (typeof value !== "string") return null;
  const slot = slotRoomKey(value);
  if (slot) return `slot:${slot.chainId}:${slot.name}`;
  return GAME_ROOM.test(value) || isAspectRoom(value) ? (value as ChatRoomId) : null;
};

const gameRoomOf = (chainId: string, gameId: number): ChatRoomId => `game:${chainId}:${gameId}`;

export const gameRoomsOf = async (db: D1Database, realmsId: string): Promise<ChatRoomId[]> => {
  const account = await db
    .prepare('SELECT "address" FROM "realms_accounts" WHERE "realmsId" = ? LIMIT 1')
    .bind(realmsId)
    .first<{ address: string }>();
  if (!account) return [];
  const shard = await directoryShard(db);
  if (!shard) return [];
  try {
    const directory = await fetchHeraldGameDirectory({ url: shard.url }, account.address);
    const open = directory.games.filter((game) => game.status === "Registration" || game.status === "Live");
    const blitz = open
      .filter((game) => game.mode === "blitz" && Boolean(game.player_state?.registered || game.player_state?.settled))
      .map((game) => gameRoomOf(shard.chainId, game.game_id));
    const aspectRooms = await Promise.all(
      open
        .filter((game) => game.mode === "frontier")
        .map((game) => aspectRoomOf(db, { chainId: shard.chainId, gameId: game.game_id }, account.address)),
    );
    return [...blitz, ...aspectRooms.flat()];
  } catch (error) {
    console.error("chat_membership_unavailable", shard.url, error);
    return [];
  }
};

const aspectRoomOf = async (
  db: D1Database,
  game: { chainId: string; gameId: number },
  account: string,
): Promise<ChatRoomId[]> => {
  try {
    const aspect = await aspectOn({ DB: db }, fetch, game, account);
    return aspect === null ? [] : [aspectChatRoom(game.chainId, game.gameId, aspect)];
  } catch (error) {
    console.error("chat_aspect_unavailable", game.chainId, game.gameId, error);
    return [];
  }
};

export const isRoomMember = async (db: D1Database, realmsId: string, room: ChatRoomId): Promise<boolean> =>
  room === GLOBAL_CHAT_CHANNEL_ID || (await gameRoomsOf(db, realmsId)).includes(room);
