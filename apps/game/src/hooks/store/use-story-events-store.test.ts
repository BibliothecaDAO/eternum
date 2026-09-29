import { describe, expect, it } from "vitest";

import { toStreamStoryEvent } from "./use-story-events-store";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 54 };

describe("story event stream", () => {
  it("retains the native story payload and action identity", () => {
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
        },
      },
      scope,
    );

    expect(event).toMatchObject({
      storyPayload: { structure_id: "0x2a", bank_id: "0x2b", buy: true },
      entity_id: 42,
      event_id: "story:v2:0x1:0xabc:0x36:0x7:0x0",
      owner: "0xabc",
      story: "BankSwap",
      timestamp: "0x64",
      tx_hash: "0xfeed",
    });
  });

  it("keeps two stories distinct across overlay and confirmation with an intervening points fact", () => {
    const story = (index: number) => ({
      model: "StoryEvent",
      key: `0x${index}`,
      value: {
        game_id: 54,
        order: 7,
        index,
        tx_hash: "0xfeed",
        story: { StructureLevelUpStory: { new_level: index + 1 } },
        timestamp: 100,
      },
    });
    const points = { model: "PlayerPoints", key: "0x3", value: { game_id: 54, player: "0xabc", points: 10 } };
    const overlay = [story(0), points, story(1)];
    const confirmed = [points, story(0), story(1)];
    const identities = (events: typeof overlay, preconfirmed: boolean) =>
      events.flatMap((event, event_index) => {
        const read = toStreamStoryEvent(
          { ...event, value: { ...event.value, event_position: { transaction_hash: "0xfeed", event_index } } },
          scope,
          { block: 12, preconfirmed },
        );
        return read ? [read.event_id] : [];
      });
    expect(identities(overlay, true)).toEqual(["story:v2:0x1:0xabc:0x36:0x7:0x0", "story:v2:0x1:0xabc:0x36:0x7:0x1"]);
    expect(identities(confirmed, false)).toEqual(identities(overlay, true));
  });

  it("leaves persistent rows and point awards out of the activity stream", () => {
    for (const model of ["PlayerPoints", "PointsAwarded"]) {
      expect(toStreamStoryEvent({ model, key: "0x1", value: { game_id: 54 } }, scope)).toBeNull();
    }
  });

  it.each(["BattleEvent", "RaidEvent"])("keeps %s identity when receipt positions change", (model) => {
    const value = { game_id: 54, order: 7, index: 2, timestamp: 100 };
    const event = (event_index: number) => ({
      model,
      key: "0x1",
      value: {
        ...value,
        event_position: { transaction_hash: "0xfeed", event_index },
      },
    });
    const overlay = toStreamStoryEvent(event(1), scope, { block: 12, preconfirmed: true });
    const confirmed = toStreamStoryEvent(event(4), scope, { block: 12, preconfirmed: false });
    expect(overlay?.event_id).toBe("story:v2:0x1:0xabc:0x36:0x7:0x2");
    expect(confirmed?.event_id).toBe(overlay?.event_id);
  });

  it("rejects a combat event without its recorded action identity", () => {
    expect(() => toStreamStoryEvent({ model: "BattleEvent", key: "0x1", value: { game_id: 54 } }, scope)).toThrow(
      "order",
    );
  });
});
