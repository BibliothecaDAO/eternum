import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { createChatChannelPolicy } from "./chat-policy";

const membership = () => ({
  channelsForPlayer: vi.fn(() => Effect.succeed(new Set(["game:7"]))),
  isMember: vi.fn((_player: string, channel: string) => Effect.succeed(channel === "game:7")),
});

describe("chat channel policy", () => {
  it("gives players without game accounts the shared channel without querying Herald", async () => {
    const resolver = membership();
    const chat = createChatChannelPolicy(resolver);
    expect(await Effect.runPromise(chat.gameChannelsForPlayer(null))).toEqual(new Set());
    expect(await Effect.runPromise(chat.isMember(null, GLOBAL_CHAT_CHANNEL_ID))).toBe(true);
    expect(await Effect.runPromise(chat.isMember(null, "game:7"))).toBe(false);
    expect(chat.isValidChannel("game:7")).toBe(true);
    expect(resolver.isMember).not.toHaveBeenCalled();
    expect(resolver.channelsForPlayer).not.toHaveBeenCalled();
  });

  it("keeps game channels member-only alongside global chat", async () => {
    const chat = createChatChannelPolicy(membership());
    expect(await Effect.runPromise(chat.gameChannelsForPlayer(null))).toEqual(new Set());
    expect(await Effect.runPromise(chat.gameChannelsForPlayer("0xa"))).toEqual(new Set(["game:7"]));
    expect(await Effect.runPromise(chat.isMember("0xa", "game:7"))).toBe(true);
    expect(await Effect.runPromise(chat.isMember("0xa", "game:8"))).toBe(false);
    expect(await Effect.runPromise(chat.isMember(null, "game:7"))).toBe(false);
    expect(await Effect.runPromise(chat.isMember("0xa", GLOBAL_CHAT_CHANNEL_ID))).toBe(true);
    expect(chat.isValidChannel(GLOBAL_CHAT_CHANNEL_ID)).toBe(true);
  });
});
