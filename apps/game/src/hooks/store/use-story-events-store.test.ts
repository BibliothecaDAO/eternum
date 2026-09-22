import { describe, expect, it } from "vitest";

import { toStreamStoryEvent } from "./use-story-events-store";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 54 };

describe("story event stream", () => {
  it("retains the native story payload and receipt identity", () => {
    const event = toStreamStoryEvent(
      {
        hashed_keys: "0xstory",
        models: {
          StoryEvent: {
            game_id: "0x36",
            id: "0x7",
            owner: "0xabc",
            entity_id: "0x2a",
            tx_hash: "0xfeed",
            story: {
              BankSwap: { structure_id: "0x2a", bank_id: "0x2b", buy: true },
            },
            timestamp: "0x64",
          },
        },
      },
      scope,
    );

    expect(event).toMatchObject({
      storyPayload: { structure_id: "0x2a", bank_id: "0x2b", buy: true },
      entity_id: 42,
      event_id: "story:v1:0x1:0xabc:0x36:0xfeed:0x7",
      owner: "0xabc",
      story: "BankSwap",
      timestamp: "0x64",
      tx_hash: "0xfeed",
    });
  });

  it("leaves persistent rows and point awards out of the activity stream", () => {
    for (const model of ["PlayerPoints", "PointsAwarded"]) {
      expect(toStreamStoryEvent({ hashed_keys: "0x1", models: { [model]: { game_id: 54 } } }, scope)).toBeNull();
    }
  });

  it("rejects a combat event without its receipt identity", () => {
    expect(() => toStreamStoryEvent({ hashed_keys: "0x1", models: { BattleEvent: { game_id: 54 } } }, scope)).toThrow(
      "transaction hash",
    );
  });
});
