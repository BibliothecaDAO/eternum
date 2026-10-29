import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { chatRooms } from "./chat-rooms";

const GLOBAL = { zoneId: GLOBAL_CHAT_CHANNEL_ID, label: "Global" };

describe("the rooms a player has", () => {
  it("is Global alone outside a game", () => {
    expect(chatRooms(null)).toEqual([GLOBAL]);
  });

  it.each(["frontier", "blitz", "eternum", "duel"] as const)("is Global alone in a %s game: no game room", (mode) => {
    expect(chatRooms({ zoneId: "game:0x52:7", mode })).toEqual([GLOBAL]);
  });
});
