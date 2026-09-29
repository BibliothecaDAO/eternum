import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

/** A chat room: the world room everyone shares, or one Blitz game on one shard, named by chain and game. */
type ChatRoomId = typeof GLOBAL_CHAT_CHANNEL_ID | `game:${string}:${number}`;

const GAME_ROOM = /^game:(0x[0-9a-f]{1,64}):([1-9][0-9]{0,9})$/;

export const parseChatRoom = (value: unknown): ChatRoomId | null => {
  if (value === GLOBAL_CHAT_CHANNEL_ID) return GLOBAL_CHAT_CHANNEL_ID;
  return typeof value === "string" && GAME_ROOM.test(value) ? (value as ChatRoomId) : null;
};

const gameRoomOf = (chainId: string, gameId: number): ChatRoomId => `game:${chainId}:${gameId}`;

/**
 * The game rooms a Realms account belongs to: every Blitz game, on every shard in our directory, in which its account
 * is registered or settled while the game takes registrations or is live. The shard's Herald decides membership; a
 * shard that cannot answer grants none.
 */
export const gameRoomsOf = async (db: D1Database, realmsId: string): Promise<ChatRoomId[]> => {
  const account = await db
    .prepare('SELECT "address" FROM "realms_accounts" WHERE "realmsId" = ? LIMIT 1')
    .bind(realmsId)
    .first<{ address: string }>();
  if (!account) return [];
  const { results: shards } = await db
    .prepare(`SELECT "url", "chainId" FROM "shards" WHERE "status" != 'retired'`)
    .all<{ url: string; chainId: string }>();
  const rooms = await Promise.all(
    shards.map(async (shard) => {
      try {
        const directory = await fetchHeraldGameDirectory({ url: shard.url }, account.address);
        return directory.games
          .filter(
            (game) =>
              game.mode === "blitz" &&
              (game.status === "Registration" || game.status === "Live") &&
              Boolean(game.player_state?.registered || game.player_state?.settled),
          )
          .map((game) => gameRoomOf(shard.chainId, game.game_id));
      } catch (error) {
        console.error("chat_membership_unavailable", shard.url, error);
        return [];
      }
    }),
  );
  return rooms.flat();
};

export const isRoomMember = async (db: D1Database, realmsId: string, room: ChatRoomId): Promise<boolean> =>
  room === GLOBAL_CHAT_CHANNEL_ID || (await gameRoomsOf(db, realmsId)).includes(room);
