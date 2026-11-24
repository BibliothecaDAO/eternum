import { aspectChatRoom, aspects, GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { aspectRooms, chatRooms, gameAspectRooms, newestAspectRoom } from "./chat-rooms";

const GLOBAL = { zoneId: GLOBAL_CHAT_CHANNEL_ID, label: "Global" };

describe("the rooms a player has", () => {
  it("is Global alone outside a game", () => {
    expect(chatRooms(null)).toEqual([GLOBAL]);
  });

  it.each(["frontier", "blitz", "eternum"] as const)("is Global alone in a %s game: no game room", (mode) => {
    expect(chatRooms({ zoneId: "game:0x52:7", mode })).toEqual([GLOBAL]);
  });
});

describe("the Aspect rooms the chat server grants", () => {
  it("names each granted Aspect room by its Aspect, and nothing else the server lists", () => {
    const luminary = aspects.find(({ id }) => id === 2)!;
    expect(
      aspectRooms([
        GLOBAL_CHAT_CHANNEL_ID,
        "game:0x52:7",
        aspectChatRoom("0x52", 7, 2),
        aspectChatRoom("0x52", 7, 9),
        "aspect:0x52:0:2",
      ]),
    ).toEqual([{ zoneId: aspectChatRoom("0x52", 7, 2), label: luminary.name }]);
  });
});

describe("the Aspect room a game's chat shows", () => {
  it("is that game's Aspect room alone, never another game's", () => {
    const granted = [aspectChatRoom("0x52", 7, 2), aspectChatRoom("0x52", 8, 2), aspectChatRoom("0x53", 7, 2)];
    expect(gameAspectRooms(granted, { chainId: "0x0052", gameId: 7 }).map(({ zoneId }) => zoneId)).toEqual([
      aspectChatRoom("0x52", 7, 2),
    ]);
  });
});

describe("the Aspect room the app's chat shows", () => {
  it("is the newest game's alone, so one tab never stands for two games", () => {
    const granted = [aspectChatRoom("0x52", 7, 2), aspectChatRoom("0x52", 9, 3), aspectChatRoom("0x52", 8, 1)];
    expect(newestAspectRoom(granted)).toEqual([
      { zoneId: aspectChatRoom("0x52", 9, 3), label: aspects.find(({ id }) => id === 3)!.name },
    ]);
    expect(newestAspectRoom([GLOBAL_CHAT_CHANNEL_ID])).toEqual([]);
  });
});
