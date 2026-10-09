import { describe, expect, it } from "vitest";

import { toStreamStoryEvent } from "./use-story-events-store";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 54 };

describe("story event stream", () => {
  it("retains the native story payload and its identity: transaction and event index", () => {
    const event = toStreamStoryEvent(
      {
        model: "StoryEvent",
        key: "0xstory",
        value: {
          game_id: "0x36",
          order: "0x7",
          index: "0x0",
          owner: "0xabc",
          entity_id: "0x2a",
          tx_hash: "0xfeed",
          story: {
            BankSwap: { structure_id: "0x2a", bank_id: "0x2b", buy: true },
          },
          timestamp: "0x64",
          event_position: { block_number: 12, transaction_hash: "0xfeed", transaction_index: 0, event_index: 0 },
        },
      },
      scope,
    );

    expect(event).toMatchObject({
      storyPayload: { structure_id: "0x2a", bank_id: "0x2b", buy: true },
      entity_id: 42,
      event_id: "story:v2:0x1:0xabc:0x36:0xfeed:0x0",
      owner: "0xabc",
      story: "BankSwap",
      timestamp: "0x64",
      tx_hash: "0xfeed",
    });
  });

  it("keeps two stories of one transaction distinct, and each the same from overlay to confirmation", () => {
    const story = (event_index: number, block: number | null) => ({
      model: "StoryEvent",
      key: `0x${event_index}`,
      value: {
        game_id: 54,
        tx_hash: "0xfeed",
        story: { StructureLevelUpStory: { new_level: event_index + 1 } },
        timestamp: 100,
        event_position: { block_number: block, transaction_hash: "0xfeed", transaction_index: 0, event_index },
      },
    });
    const identities = (block: number | null) =>
      [story(0, block), story(2, block)].map(
        (event) => toStreamStoryEvent(event, scope, { block, preconfirmed: block === null })!.event_id,
      );
    expect(identities(null)).toEqual(["story:v2:0x1:0xabc:0x36:0xfeed:0x0", "story:v2:0x1:0xabc:0x36:0xfeed:0x2"]);
    expect(identities(12)).toEqual(identities(null));
  });

  it("leaves persistent rows and point awards out of the activity stream", () => {
    for (const model of ["PlayerPoints", "PointsAwarded"]) {
      expect(toStreamStoryEvent({ model, key: "0x1", value: { game_id: 54 } }, scope)).toBeNull();
    }
  });

  it.each(["BattleEvent", "RaidEvent"])("keeps %s identity when its transaction confirms at another place", (model) => {
    const event = (block: number | null, transaction_index: number) => ({
      model,
      key: "0x1",
      value: {
        game_id: 54,
        timestamp: 100,
        event_position: { block_number: block, transaction_hash: "0xfeed", transaction_index, event_index: 2 },
      },
    });
    const overlay = toStreamStoryEvent(event(null, 0), scope, { block: null, preconfirmed: true });
    const confirmed = toStreamStoryEvent(event(12, 4), scope, { block: 12, preconfirmed: false });
    expect(overlay?.event_id).toBe("story:v2:0x1:0xabc:0x36:0xfeed:0x2");
    expect(confirmed?.event_id).toBe(overlay?.event_id);
  });

  it("rejects a combat event without its place on the chain", () => {
    expect(() => toStreamStoryEvent({ model: "BattleEvent", key: "0x1", value: { game_id: 54 } }, scope)).toThrow(
      "no event position",
    );
  });
});
