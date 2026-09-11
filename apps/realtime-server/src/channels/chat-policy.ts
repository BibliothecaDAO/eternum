import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { Effect } from "effect";
import { parseGameChannel } from "./channel";
import type { MembershipResolver } from "./membership";

/** Global chat needs a session; game chat also needs registration in that game. */
export function createChatChannelPolicy(membership: MembershipResolver) {
  return {
    isValidChannel: (channelId: unknown) =>
      channelId === GLOBAL_CHAT_CHANNEL_ID || parseGameChannel(channelId) !== null,
    gameChannelsForPlayer: (playerId: string | null) =>
      playerId ? membership.channelsForPlayer(playerId) : Effect.succeed<ReadonlySet<string>>(new Set()),
    isMember: (playerId: string | null, channelId: string) => {
      if (channelId === GLOBAL_CHAT_CHANNEL_ID) return Effect.succeed(true);
      return playerId && parseGameChannel(channelId) ? membership.isMember(playerId, channelId) : Effect.succeed(false);
    },
  };
}

export type ChatChannelPolicy = ReturnType<typeof createChatChannelPolicy>;
