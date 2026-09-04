import { describe, expect, it } from "vitest";

import { toStreamStoryEvent } from "./use-story-events-store";

describe("story event stream", () => {
  it("adapts a Herald StoryEvent to the existing presentation shape", () => {
    const event = toStreamStoryEvent({
      hashed_keys: "0xstory",
      models: {
        StoryEvent: {
          game_id: "0x36",
          id: "0x7",
          owner: "0xabc",
          entity_id: "0x2a",
          tx_hash: "0xfeed",
          story: {
            BattleStory: {
              attacker_id: "0x2a",
              defender_id: "0x2b",
              winner_id: "0x2a",
              attacker_owner_address: "0xabc",
              defender_owner_address: "0xdef",
            },
          },
          timestamp: "0x64",
        },
      },
    });

    expect(event).toMatchObject({
      battle_attacker_id: "0x2a",
      battle_defender_id: "0x2b",
      battle_winner_id: "0x2a",
      entity_id: 42,
      event_id: "0xstory:0xfeed",
      owner: "0xabc",
      story: "BattleStory",
      timestamp: "0x64",
      tx_hash: "0xfeed",
    });
  });

  it("ignores non-story event models", () => {
    expect(toStreamStoryEvent({ hashed_keys: "0x1", models: { BattleEvent: {} } })).toBeNull();
  });
});
